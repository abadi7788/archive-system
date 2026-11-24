import hmac
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, SecretStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import admin_user, current_user
from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db import get_db
from app.models.audit_log import AuditLog
from app.models.user import User

router = APIRouter()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class MasterChallenge(BaseModel):
    password: SecretStr


class ChangePasswordPayload(BaseModel):
    current_password: SecretStr = Field(min_length=1)
    new_password: SecretStr = Field(min_length=6, max_length=200)


def _serialize_user(user: User) -> dict:
    return {
        "id": str(user.id),
        "username": user.username,
        "role": user.role.value,
        "department": user.department,
        "is_active": user.is_active,
        "must_change_password": bool(user.must_change_password),
    }


@router.post("/login", response_model=TokenResponse)
async def login(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: Annotated[AsyncSession, Depends(get_db)]):
    user = await db.scalar(select(User).where(User.username == form.username))
    if not user or not user.is_active or not verify_password(form.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(str(user.id), claims={"role": user.role.value})
    return TokenResponse(access_token=token, user=_serialize_user(user))


@router.get("/me")
async def get_me(user: Annotated[User, Depends(current_user)]):
    return _serialize_user(user)


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordPayload,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
):
    current_pw = payload.current_password.get_secret_value()
    new_pw = payload.new_password.get_secret_value()
    if not verify_password(current_pw, user.password_hash):
        raise HTTPException(status_code=400, detail="كلمة المرور الحالية غير صحيحة")
    if current_pw == new_pw:
        raise HTTPException(status_code=422, detail="يجب أن تختلف كلمة المرور الجديدة عن كلمة المرور الحالية")
    try:
        user.password_hash = hash_password(new_pw)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    user.must_change_password = False
    db.add(
        AuditLog(
            actor_id=user.id,
            action="user.password_changed",
            resource_type="user",
            resource_id=str(user.id),
            detail={"first_login_completed": True},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()
    await db.refresh(user)
    return {"message": "تم تحديث كلمة المرور بنجاح", "user": _serialize_user(user)}


@router.post("/admin/master-challenge")
async def master_challenge(payload: MasterChallenge, _: Annotated[User, Depends(admin_user)]):
    expected = settings.master_admin_password.get_secret_value()
    if not hmac.compare_digest(payload.password.get_secret_value(), expected):
        raise HTTPException(status_code=403, detail="Master password is incorrect")
    # Short-lived, scoped step-up token; never return or persist the master password.
    return {"step_up_token": create_access_token("master-admin", expires_minutes=10, claims={"scope": "admin:settings"})}
