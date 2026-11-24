import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, SecretStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import admin_user
from app.core.security import encrypt_secret, hash_password
from app.db import get_db
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole

router = APIRouter()


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=120, pattern=r"^[A-Za-z0-9_.-]+$")
    password: SecretStr = Field(min_length=6, max_length=200)
    role: UserRole = UserRole.ARCHIVER
    department: str | None = Field(default=None, max_length=160)
    gemini_api_key: SecretStr | None = None
    must_change_password: bool = True


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=120, pattern=r"^[A-Za-z0-9_.-]+$")
    department: str | None = Field(default=None, max_length=160)
    role: UserRole | None = None
    is_active: bool | None = None
    password: SecretStr | None = Field(default=None, min_length=6, max_length=200)
    must_change_password: bool | None = None
    gemini_api_key: SecretStr | None = None


def _user_dict(u: User) -> dict:
    return {
        "id": str(u.id),
        "username": u.username,
        "role": u.role.value,
        "department": u.department,
        "is_active": u.is_active,
        "must_change_password": bool(u.must_change_password),
    }


@router.post("", status_code=201)
async def create_user(
    payload: UserCreate,
    actor: Annotated[User, Depends(admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if await db.scalar(select(User.id).where(User.username == payload.username)):
        raise HTTPException(status_code=409, detail="Username already exists")
    try:
        pw_hash = hash_password(payload.password.get_secret_value())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    key = payload.gemini_api_key.get_secret_value() if payload.gemini_api_key else None
    user = User(
        username=payload.username,
        password_hash=pw_hash,
        role=payload.role,
        department=payload.department,
        gemini_key_encrypted=encrypt_secret(key) if key else None,
        must_change_password=payload.must_change_password,
    )
    db.add(user)
    await db.flush()
    db.add(
        AuditLog(
            actor_id=actor.id,
            action="user.created",
            resource_type="user",
            resource_id=str(user.id),
            detail={"role": user.role.value, "must_change_password": user.must_change_password},
        )
    )
    await db.commit()
    await db.refresh(user)
    return _user_dict(user)


@router.patch("/{user_id}")
async def update_user(
    user_id: str,
    payload: UserUpdate,
    actor: Annotated[User, Depends(admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(422, "Invalid user id")
    user = await db.get(User, user_uuid)
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == actor.id and payload.is_active is False:
        raise HTTPException(400, "You cannot disable your own account")
    if payload.username and payload.username != user.username and await db.scalar(select(User.id).where(User.username == payload.username)):
        raise HTTPException(409, "Username already exists")
    changes = []
    if payload.username is not None:
        user.username = payload.username
        changes.append("username")
    if "department" in payload.model_fields_set:
        user.department = payload.department
        changes.append("department")
    if payload.role is not None:
        user.role = payload.role
        changes.append("role")
    if payload.is_active is not None:
        user.is_active = payload.is_active
        changes.append("is_active")
    if payload.password is not None:
        try:
            user.password_hash = hash_password(payload.password.get_secret_value())
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        user.must_change_password = True if payload.must_change_password is None else payload.must_change_password
        changes.append("password")
    elif payload.must_change_password is not None:
        user.must_change_password = payload.must_change_password
        changes.append("must_change_password")
    if payload.gemini_api_key is not None:
        user.gemini_key_encrypted = encrypt_secret(payload.gemini_api_key.get_secret_value())
        changes.append("gemini_key")
    db.add(
        AuditLog(
            actor_id=actor.id,
            action="user.updated",
            resource_type="user",
            resource_id=str(user.id),
            detail={"fields": changes},
        )
    )
    await db.commit()
    return _user_dict(user)


@router.get("")
async def list_users(_: Annotated[User, Depends(admin_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    users = (await db.scalars(select(User).order_by(User.username))).all()
    return [_user_dict(u) for u in users]
