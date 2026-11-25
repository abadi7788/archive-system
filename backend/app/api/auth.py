import hmac
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, SecretStr
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import admin_user, current_user
from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db import get_db
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole

router = APIRouter()

SUPPORTED_LANGUAGES = {"ar", "en", "fr", "es", "tr", "de", "ru", "zh", "ja", "hi", "ur"}
SUPPORTED_THEMES = {"light", "dark"}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class MasterChallenge(BaseModel):
    password: SecretStr


class ChangePasswordPayload(BaseModel):
    current_password: SecretStr | None = Field(default=None)
    new_password: SecretStr = Field(min_length=6, max_length=200)


class PreferencesUpdate(BaseModel):
    preferred_language: str | None = Field(default=None, max_length=16)
    preferred_theme: str | None = Field(default=None, max_length=16)


def _serialize_user(user: User) -> dict:
    return {
        "id": str(user.id),
        "username": user.username,
        "full_name": user.full_name,
        "job_title": user.job_title,
        "role": user.role.value,
        "department": user.department,
        "preferred_language": user.preferred_language,
        "preferred_theme": user.preferred_theme or "light",
        "is_active": user.is_active,
        "must_change_password": bool(user.must_change_password),
        "can_print": bool(user.role == UserRole.ADMIN or user.can_print),
    }


async def _extract_login_credentials(request: Request) -> tuple[str, str]:
    """Accept both standard OAuth2 form-urlencoded and JSON login payloads safely."""
    content_type = (request.headers.get("content-type") or "").lower()
    username = ""
    password = ""

    if "application/json" in content_type:
        try:
            body = await request.json()
            if isinstance(body, dict):
                username = str(body.get("username") or "")
                password = str(body.get("password") or "")
        except Exception:
            pass
    else:
        try:
            form = await request.form()
            username = str(form.get("username") or "")
            password = str(form.get("password") or "")
        except Exception:
            pass

    return username.strip(), password


@router.post("/login", response_model=TokenResponse)
async def login(request: Request, db: Annotated[AsyncSession, Depends(get_db)]):
    username, password = await _extract_login_credentials(request)
    if not username or not password:
        db.add(AuditLog(action="auth.login_failed", resource_type="auth", detail={"username": username[:120]}))
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await db.scalar(select(User).where(User.username == username))
    if not user:
        # Case-insensitive fallback if exact username casing differs
        user = await db.scalar(select(User).where(func.lower(User.username) == username.lower()))

    if not user or not user.is_active or not verify_password(password, user.password_hash):
        db.add(AuditLog(actor_id=user.id if user else None, action="auth.login_failed", resource_type="auth", detail={"username": username[:120], "actor_name": (user.full_name or user.username) if user else username[:120]}))
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    db.add(AuditLog(actor_id=user.id, action="auth.login", resource_type="auth", detail={"actor_name": user.full_name or user.username}))
    await db.commit()
    token = create_access_token(str(user.id), claims={"role": user.role.value})
    return TokenResponse(access_token=token, user=_serialize_user(user))


@router.get("/me")
async def get_me(user: Annotated[User, Depends(current_user)]):
    return _serialize_user(user)


@router.patch("/preferences")
async def update_preferences(
    payload: PreferencesUpdate,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if payload.preferred_language is not None:
        lang = payload.preferred_language.strip().lower()
        if lang not in SUPPORTED_LANGUAGES:
            raise HTTPException(status_code=422, detail="Unsupported language selection")
        user.preferred_language = lang
    if payload.preferred_theme is not None:
        theme = payload.preferred_theme.strip().lower()
        if theme not in SUPPORTED_THEMES:
            raise HTTPException(status_code=422, detail="Unsupported theme selection")
        user.preferred_theme = theme
    await db.commit()
    await db.refresh(user)
    return _serialize_user(user)


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordPayload,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
):
    current_pw = payload.current_password.get_secret_value() if payload.current_password else ""
    new_pw = payload.new_password.get_secret_value()

    if user.must_change_password:
        # Mandatory first-login or post-reset password change:
        # If current_password is supplied, verify it; always forbid reusing the basic/temp password.
        if current_pw and not verify_password(current_pw, user.password_hash):
            raise HTTPException(status_code=400, detail="كلمة المرور الحالية غير صحيحة")
        if verify_password(new_pw, user.password_hash):
            raise HTTPException(status_code=422, detail="يجب أن تختلف كلمة المرور الجديدة عن كلمة المرور الأساسية")
    else:
        if not current_pw or not verify_password(current_pw, user.password_hash):
            raise HTTPException(status_code=400, detail="كلمة المرور الحالية غير صحيحة")
        if current_pw == new_pw or verify_password(new_pw, user.password_hash):
            raise HTTPException(status_code=422, detail="يجب أن تختلف كلمة المرور الجديدة عن كلمة المرور الحالية")

    was_first_login = bool(user.must_change_password)
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
            detail={"first_login_completed": was_first_login},
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


@router.post('/logout')
async def logout(user: Annotated[User, Depends(current_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    db.add(AuditLog(actor_id=user.id, action='auth.logout', resource_type='auth', detail={}))
    await db.commit()
    return {"ok": True}
