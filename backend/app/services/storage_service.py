import asyncio
import logging
import os
import tempfile
import io
import shutil
from app.services.encrypted_stream import MAGIC, encrypt_file, decrypted_records
from pathlib import Path
from typing import Protocol

import boto3
from botocore.config import Config

from app.core.config import settings
from app.core.security import _fernet

logger = logging.getLogger(__name__)
LOCAL_ROOT = Path(os.getenv("LOCAL_STORAGE_ROOT", "/data/archive"))
ACTIVE_PROVIDER = settings.storage_provider.lower()


class Storage(Protocol):
    async def put(self, key: str, data: bytes, content_type: str) -> None: ...
    async def put_file(self, key: str, source, content_type: str) -> None: ...
    def iter_content(self, key: str): ...
    async def get(self, key: str) -> bytes: ...
    async def ping(self) -> bool: ...
    async def delete(self, key: str) -> None: ...
    async def list_keys(self) -> list[str]: ...


class LocalStorage:
    def _path(self, key: str) -> Path:
        root = LOCAL_ROOT.resolve()
        target = (root / key).resolve()
        if root not in target.parents:
            raise ValueError("Invalid storage key")
        return target

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        try:
            await asyncio.to_thread(LOCAL_ROOT.mkdir, parents=True, exist_ok=True)
            path = self._path(key)
            await asyncio.to_thread(path.parent.mkdir, parents=True, exist_ok=True)
            encrypted = _fernet().encrypt(data)
            await asyncio.to_thread(path.write_bytes, encrypted)
        except Exception as exc:
            logger.error("LocalStorage.put failed for key %s: %s (%s)", key, type(exc).__name__, exc)
            raise

    async def put_file(self, key: str, source, content_type: str) -> None:
        def write():
            path = self._path(key)
            path.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as target:
                temp = Path(target.name)
                try:
                    encrypt_file(source, target)
                    os.fsync(target.fileno())
                    target.close()
                    os.replace(temp, path)
                finally:
                    temp.unlink(missing_ok=True)
        await asyncio.to_thread(write)

    def iter_content(self, key: str):
        with self._path(key).open('rb') as source:
            prefix = source.read(len(MAGIC))
            source.seek(0)
            if prefix == MAGIC:
                yield from decrypted_records(source)
            else:
                yield _fernet().decrypt(source.read())  # Legacy files were capped at 40 MiB.

    async def get(self, key: str) -> bytes:
        return await asyncio.to_thread(lambda: b''.join(self.iter_content(key)))

    async def ping(self) -> bool:
        try:
            await asyncio.to_thread(LOCAL_ROOT.mkdir, parents=True, exist_ok=True)
            return True
        except Exception as exc:
            logger.error("LocalStorage.ping failed at %s: %s", LOCAL_ROOT, exc)
            return False

    async def delete(self, key: str) -> None:
        path=self._path(key)
        if await asyncio.to_thread(path.exists):
            await asyncio.to_thread(path.unlink)

    async def list_keys(self) -> list[str]:
        def scan():
            if not LOCAL_ROOT.exists():return []
            return [p.relative_to(LOCAL_ROOT).as_posix() for p in LOCAL_ROOT.rglob('*') if p.is_file() and not p.is_symlink() and '.uploads' not in p.relative_to(LOCAL_ROOT).parts]
        return await asyncio.to_thread(scan)


class S3Storage:
    def __init__(self):
        self.client = boto3.client(
            "s3", endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key.get_secret_value(),
            aws_secret_access_key=settings.s3_secret_key.get_secret_value(),
            region_name=settings.s3_region,
            config=Config(connect_timeout=3, read_timeout=5, retries={"max_attempts": 1}),
        )
        self.bucket = settings.s3_bucket_name

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        encrypted = _fernet().encrypt(data)
        await asyncio.to_thread(self.client.put_object, Bucket=self.bucket, Key=key, Body=encrypted, ContentType="application/octet-stream", Metadata={"archive-encryption":"fernet"})

    async def put_file(self, key: str, source, content_type: str) -> None:
        def write():
            with tempfile.TemporaryFile() as encrypted:
                encrypt_file(source, encrypted)
                encrypted.seek(0)
                self.client.upload_fileobj(encrypted, self.bucket, key, ExtraArgs={"ContentType": "application/octet-stream", "Metadata": {"archive-encryption": "records-v2"}})
        await asyncio.to_thread(write)

    def iter_content(self, key: str):
        body = self.client.get_object(Bucket=self.bucket, Key=key)['Body']
        try:
            prefix = body.read(len(MAGIC))
            if prefix == MAGIC:
                class Reader:
                    def __init__(self): self.prefix = prefix
                    def read(self, size=-1):
                        if size < 0:
                            data, self.prefix = self.prefix, b''
                            return data + body.read()
                        first, self.prefix = self.prefix[:size], self.prefix[size:]
                        return first + body.read(size - len(first)) if len(first) < size else first
                yield from decrypted_records(Reader())
            else:
                yield _fernet().decrypt(prefix + body.read())
        finally:
            body.close()

    async def get(self, key: str) -> bytes:
        return await asyncio.to_thread(lambda: b''.join(self.iter_content(key)))

    async def ping(self) -> bool:
        try:
            await asyncio.to_thread(self.client.head_bucket, Bucket=self.bucket)
            return True
        except Exception:
            return False

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self.client.delete_object, Bucket=self.bucket, Key=key)

    async def list_keys(self) -> list[str]:
        def scan():
            keys=[];paginator=self.client.get_paginator('list_objects_v2')
            for page in paginator.paginate(Bucket=self.bucket):
                keys.extend(obj['Key'] for obj in page.get('Contents',[]))
            return keys
        return await asyncio.to_thread(scan)


def get_storage() -> Storage:
    return S3Storage() if ACTIVE_PROVIDER in {"s3", "cloud"} else LocalStorage()
