import asyncio
import logging
import os
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

    async def get(self, key: str) -> bytes:
        try:
            stored = await asyncio.to_thread(self._path(key).read_bytes)
            return _fernet().decrypt(stored)
        except Exception as exc:
            logger.error("LocalStorage.get failed for key %s: %s (%s)", key, type(exc).__name__, exc)
            raise

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
            return [p.relative_to(LOCAL_ROOT).as_posix() for p in LOCAL_ROOT.rglob('*') if p.is_file() and not p.is_symlink()]
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

    async def get(self, key: str) -> bytes:
        response = await asyncio.to_thread(self.client.get_object, Bucket=self.bucket, Key=key)
        stored = await asyncio.to_thread(response["Body"].read)
        return _fernet().decrypt(stored)

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
