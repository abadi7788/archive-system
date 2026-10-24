from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import admin_user
from app.core.security import decode_access_token
from app.core.config import settings
from app.models.user import User
from app.services.storage_service import get_storage

router = APIRouter()


def require_step_up(x_admin_step_up: Annotated[str | None, Header()] = None):
    if not x_admin_step_up:
        raise HTTPException(401, "Master-password challenge required")
    try:
        token = decode_access_token(x_admin_step_up)
    except ValueError as exc:
        raise HTTPException(401, "Master-password challenge expired") from exc
    if token.get("sub") != "master-admin" or token.get("scope") != "admin:settings":
        raise HTTPException(403, "Invalid step-up authorization")
    return True


class StorageUpdate(BaseModel):
    provider: str = Field(pattern="^(local|s3)$")


@router.get("/storage")
async def storage_settings(_: Annotated[User, Depends(admin_user)], __: Annotated[bool, Depends(require_step_up)]):
    return {"provider": get_storage_provider(), "bucket": settings.s3_bucket_name, "endpoint": settings.s3_endpoint_url, "credentials_exposed": False}


@router.put("/storage")
async def update_storage(payload: StorageUpdate, _: Annotated[User, Depends(admin_user)], __: Annotated[bool, Depends(require_step_up)]):
    set_storage_provider(payload.provider)
    return {"provider": payload.provider, "message": "Storage provider changed for this backend process"}


@router.post("/storage/test")
async def test_storage(_: Annotated[User, Depends(admin_user)], __: Annotated[bool, Depends(require_step_up)]):
    ok = await get_storage().ping()
    return {"ok": ok, "provider": get_storage_provider(), "message": "Connection successful" if ok else "Connection failed"}


@router.get("/storage/sync-status")
async def sync_status(_: Annotated[User, Depends(admin_user)], __: Annotated[bool, Depends(require_step_up)]):
    # Replication is not enabled by this initial gateway; never report a fabricated healthy state.
    return {"status": "not_configured", "local_to_cloud": False, "detail": "No replication worker is configured"}


from app.services import storage_service as _storage

def get_storage_provider() -> str:
    return _storage.ACTIVE_PROVIDER

def set_storage_provider(provider: str) -> None:
    _storage.ACTIVE_PROVIDER = provider
