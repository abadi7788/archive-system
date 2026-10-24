from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, SecretStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import admin_user
from app.core.security import encrypt_secret, hash_password
from app.db import get_db
from app.models.user import User, UserRole

router = APIRouter()


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=120, pattern=r"^[A-Za-z0-9_.-]+$")
    password: SecretStr = Field(min_length=12)
    role: UserRole = UserRole.EMPLOYEE
    gemini_api_key: SecretStr | None = None


@router.post("", status_code=201)
async def create_user(payload: UserCreate, _: Annotated[User, Depends(admin_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    if await db.scalar(select(User.id).where(User.username == payload.username)):
        raise HTTPException(status_code=409, detail="Username already exists")
    key = payload.gemini_api_key.get_secret_value() if payload.gemini_api_key else None
    user = User(username=payload.username, password_hash=hash_password(payload.password.get_secret_value()), role=payload.role,
                gemini_key_encrypted=encrypt_secret(key) if key else None)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {"id": str(user.id), "username": user.username, "role": user.role.value, "is_active": user.is_active}


@router.get("")
async def list_users(_: Annotated[User, Depends(admin_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    users = (await db.scalars(select(User).order_by(User.username))).all()
    return [{"id": str(u.id), "username": u.username, "role": u.role.value, "is_active": u.is_active} for u in users]
