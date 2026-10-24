import hmac
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, SecretStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import admin_user
from app.core.config import settings
from app.core.security import create_access_token, verify_password
from app.db import get_db
from app.models.user import User

router = APIRouter()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class MasterChallenge(BaseModel):
    password: SecretStr


@router.post("/login", response_model=TokenResponse)
async def login(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: Annotated[AsyncSession, Depends(get_db)]):
    user = await db.scalar(select(User).where(User.username == form.username))
    if not user or not user.is_active or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password", headers={"WWW-Authenticate": "Bearer"})
    token = create_access_token(str(user.id), claims={"role": user.role.value})
    return TokenResponse(access_token=token, user={"id": str(user.id), "username": user.username, "role": user.role.value})


@router.post("/admin/master-challenge")
async def master_challenge(payload: MasterChallenge, _: Annotated[User, Depends(admin_user)]):
    expected = settings.master_admin_password.get_secret_value()
    if not hmac.compare_digest(payload.password.get_secret_value(), expected):
        raise HTTPException(status_code=403, detail="Master password is incorrect")
    # Short-lived, scoped step-up token; never return or persist the master password.
    return {"step_up_token": create_access_token("master-admin", expires_minutes=10, claims={"scope": "admin:settings"})}
