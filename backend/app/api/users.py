import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field, SecretStr
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import build_user_display_map, get_visible_owner_ids
from app.api.deps import admin_user, current_user
from app.core.security import encrypt_secret, hash_password
from app.db import get_db
from app.models.audit_log import AuditLog
from app.models.employee_link import EmployeeLinkGroup, EmployeeLinkMember
from app.models.user import User, UserRole

router = APIRouter()


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=120, pattern=r"^[A-Za-z0-9_.-]+$")
    full_name: str | None = Field(default=None, max_length=160)
    job_title: str | None = Field(default=None, max_length=160)
    password: SecretStr = Field(min_length=6, max_length=200)
    role: UserRole = UserRole.ARCHIVER
    department: str | None = Field(default=None, max_length=160)
    gemini_api_key: SecretStr | None = None
    must_change_password: bool = True
    can_print: bool = False


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=120, pattern=r"^[A-Za-z0-9_.-]+$")
    full_name: str | None = Field(default=None, max_length=160)
    job_title: str | None = Field(default=None, max_length=160)
    department: str | None = Field(default=None, max_length=160)
    role: UserRole | None = None
    is_active: bool | None = None
    password: SecretStr | None = Field(default=None, min_length=6, max_length=200)
    must_change_password: bool | None = None
    can_print: bool | None = None
    gemini_api_key: SecretStr | None = None


class LinkGroupPayload(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    member_ids: list[uuid.UUID] = Field(min_length=2, max_length=100)


def _user_dict(u: User) -> dict:
    return {
        "id": str(u.id),
        "username": u.username,
        "full_name": u.full_name,
        "job_title": u.job_title,
        "role": u.role.value,
        "department": u.department,
        "preferred_language": u.preferred_language,
        "preferred_theme": u.preferred_theme or "light",
        "is_active": u.is_active,
        "must_change_password": bool(u.must_change_password),
        "can_print": bool(u.role == UserRole.ADMIN or u.can_print),
    }


def _clean_optional_text(val: str | None) -> str | None:
    if val is None:
        return None
    stripped = val.strip()
    return stripped or None


async def _serialize_link_groups(db: AsyncSession) -> list[dict]:
    groups = (await db.scalars(select(EmployeeLinkGroup).order_by(EmployeeLinkGroup.created_at.desc()))).all()
    if not groups:
        return []
    group_ids = [g.id for g in groups]
    member_rows = (
        await db.execute(
            select(EmployeeLinkMember.group_id, EmployeeLinkMember.user_id).where(
                EmployeeLinkMember.group_id.in_(group_ids)
            )
        )
    ).all()
    all_user_ids = {row.user_id for row in member_rows}
    user_map = await build_user_display_map(db, all_user_ids)
    members_by_group: dict[uuid.UUID, list[dict]] = {g.id: [] for g in groups}
    for row in member_rows:
        info = user_map.get(row.user_id)
        if info:
            members_by_group[row.group_id].append(info)
    return [
        {
            "id": str(g.id),
            "name": g.name,
            "created_at": g.created_at.isoformat() if g.created_at else None,
            "members": sorted(members_by_group.get(g.id, []), key=lambda m: m["display_name"].lower()),
        }
        for g in groups
    ]


@router.get("/visible-owners")
async def list_visible_owners(
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Returns users whose documents/folders the current user can view (all users for Admin; self + linked peers for employees)."""
    visible_ids = await get_visible_owner_ids(user, db)
    q = select(User).order_by(User.full_name, User.username)
    if visible_ids is not None:
        q = q.where(User.id.in_(visible_ids))
    rows = (await db.scalars(q)).all()
    return [
        {
            "id": str(u.id),
            "username": u.username,
            "full_name": u.full_name,
            "job_title": u.job_title,
            "department": u.department,
            "role": u.role.value,
            "display_name": (u.full_name or "").strip() or u.username,
        }
        for u in rows
    ]


@router.get("/link-groups")
async def list_link_groups(
    _: Annotated[User, Depends(admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await _serialize_link_groups(db)


@router.post("/link-groups", status_code=201)
async def create_link_group(
    payload: LinkGroupPayload,
    actor: Annotated[User, Depends(admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    unique_ids = list(dict.fromkeys(payload.member_ids))
    if len(unique_ids) < 2:
        raise HTTPException(422, "Select at least two employees to link")
    found = set((await db.scalars(select(User.id).where(User.id.in_(unique_ids)))).all())
    if len(found) != len(unique_ids):
        raise HTTPException(404, "One or more selected users were not found")
    group = EmployeeLinkGroup(name=payload.name.strip(), created_by=actor.id)
    db.add(group)
    await db.flush()
    for uid in unique_ids:
        db.add(EmployeeLinkMember(group_id=group.id, user_id=uid))
    db.add(
        AuditLog(
            actor_id=actor.id,
            action="employee_link_group.created",
            resource_type="employee_link_group",
            resource_id=str(group.id),
            detail={"name": group.name, "member_count": len(unique_ids)},
        )
    )
    await db.commit()
    groups = await _serialize_link_groups(db)
    return next((g for g in groups if g["id"] == str(group.id)), {"id": str(group.id), "name": group.name, "members": []})


@router.put("/link-groups/{group_id}")
async def update_link_group(
    group_id: uuid.UUID,
    payload: LinkGroupPayload,
    actor: Annotated[User, Depends(admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    group = await db.get(EmployeeLinkGroup, group_id)
    if not group:
        raise HTTPException(404, "Link group not found")
    unique_ids = list(dict.fromkeys(payload.member_ids))
    if len(unique_ids) < 2:
        raise HTTPException(422, "Select at least two employees to link")
    found = set((await db.scalars(select(User.id).where(User.id.in_(unique_ids)))).all())
    if len(found) != len(unique_ids):
        raise HTTPException(404, "One or more selected users were not found")
    group.name = payload.name.strip()
    await db.execute(delete(EmployeeLinkMember).where(EmployeeLinkMember.group_id == group_id))
    for uid in unique_ids:
        db.add(EmployeeLinkMember(group_id=group.id, user_id=uid))
    db.add(
        AuditLog(
            actor_id=actor.id,
            action="employee_link_group.updated",
            resource_type="employee_link_group",
            resource_id=str(group.id),
            detail={"name": group.name, "member_count": len(unique_ids)},
        )
    )
    await db.commit()
    groups = await _serialize_link_groups(db)
    return next((g for g in groups if g["id"] == str(group.id)), {"id": str(group.id), "name": group.name, "members": []})


@router.delete("/link-groups/{group_id}", status_code=204)
async def delete_link_group(
    group_id: uuid.UUID,
    actor: Annotated[User, Depends(admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    group = await db.get(EmployeeLinkGroup, group_id)
    if not group:
        raise HTTPException(404, "Link group not found")
    name = group.name
    await db.delete(group)
    db.add(
        AuditLog(
            actor_id=actor.id,
            action="employee_link_group.deleted",
            resource_type="employee_link_group",
            resource_id=str(group_id),
            detail={"name": name},
        )
    )
    await db.commit()
    return Response(status_code=204)


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
        full_name=_clean_optional_text(payload.full_name),
        job_title=_clean_optional_text(payload.job_title),
        password_hash=pw_hash,
        role=payload.role,
        department=_clean_optional_text(payload.department),
        gemini_key_encrypted=encrypt_secret(key) if key else None,
        must_change_password=payload.must_change_password,
        can_print=True if payload.role == UserRole.ADMIN else bool(payload.can_print),
    )
    db.add(user)
    await db.flush()
    db.add(
        AuditLog(
            actor_id=actor.id,
            action="user.created",
            resource_type="user",
            resource_id=str(user.id),
            detail={
                "role": user.role.value,
                "job_title": user.job_title,
                "must_change_password": user.must_change_password,
                "can_print": user.can_print,
            },
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
    if "full_name" in payload.model_fields_set:
        user.full_name = _clean_optional_text(payload.full_name)
        changes.append("full_name")
    if "job_title" in payload.model_fields_set:
        user.job_title = _clean_optional_text(payload.job_title)
        changes.append("job_title")
    if "department" in payload.model_fields_set:
        user.department = _clean_optional_text(payload.department)
        changes.append("department")
    if payload.role is not None:
        user.role = payload.role
        if user.role == UserRole.ADMIN:
            user.can_print = True
        changes.append("role")
    if payload.is_active is not None:
        user.is_active = payload.is_active
        changes.append("is_active")
    if payload.can_print is not None:
        user.can_print = True if user.role == UserRole.ADMIN else bool(payload.can_print)
        changes.append("can_print")
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
