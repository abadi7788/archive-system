import asyncio
import os
from pathlib import Path
from typing import Protocol

import boto3
from botocore.config import Config

from app.core.config import settings

LOCAL_ROOT = Path(os.getenv("LOCAL_STORAGE_ROOT", "/data/archive"))
ACTIVE_PROVIDER = settings.storage_provider.lower()


class Storage(Protocol):
    async def put(self, key: str, data: bytes, content_type: str) -> None: ...
    async def get(self, key: str) -> bytes: ...
    async def ping(self) -> bool: ...


class LocalStorage:
    def _path(self, key: str) -> Path:
        root = LOCAL_ROOT.resolve()
        target = (root / key).resolve()
        if root not in target.parents:
            raise ValueError("Invalid storage key")
        return target

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        path = self._path(key)
        await asyncio.to_thread(path.parent.mkdir, parents=True, exist_ok=True)
        await asyncio.to_thread(path.write_bytes, data)

    async def get(self, key: str) -> bytes:
        return await asyncio.to_thread(self._path(key).read_bytes)

    async def ping(self) -> bool:
        return await asyncio.to_thread(LOCAL_ROOT.mkdir, parents=True, exist_ok=True) is None


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
        await asyncio.to_thread(self.client.put_object, Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)

    async def get(self, key: str) -> bytes:
        response = await asyncio.to_thread(self.client.get_object, Bucket=self.bucket, Key=key)
        return await asyncio.to_thread(response["Body"].read)

    async def ping(self) -> bool:
        try:
            await asyncio.to_thread(self.client.head_bucket, Bucket=self.bucket)
            return True
        except Exception:
            return False


def get_storage() -> Storage:
    return S3Storage() if ACTIVE_PROVIDER in {"s3", "cloud"} else LocalStorage()
