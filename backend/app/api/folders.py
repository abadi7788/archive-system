import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import (
    build_document_visibility_clause,
    build_folder_visibility_clause,
    build_user_display_map,
    get_visible_owner_ids,
)
from app.api.deps import admin_user, current_user
from app.db import get_db
from app.models.audit_log import AuditLog
from app.models.document import Document
from app.models.folder import Folder, FolderGrant
from app.models.user import User, UserRole

from app.services.names import validate_name, available_name

router = APIRouter()


class FolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    parent_id: uuid.UUID | None = None


class FolderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=180)
    parent_id: uuid.UUID | None = None


class GrantCreate(BaseModel):
    user_id: uuid.UUID
    permission: str = Field(pattern="^(read|write)$")


async def _collect_descendant_folder_ids(db: AsyncSession, root_id: uuid.UUID) -> list[uuid.UUID]:
    all_rows = (await db.execute(select(Folder.id, Folder.parent_id))).all()
    children: dict[uuid.UUID | None, list[uuid.UUID]] = {}
    for row in all_rows:
        children.setdefault(row.parent_id, []).append(row.id)
    result: list[uuid.UUID] = []
    stack = [root_id]
    seen: set[uuid.UUID] = set()
    while stack:
        curr = stack.pop()
        if curr in seen:
            continue
        seen.add(curr)
        result.append(curr)
        stack.extend(children.get(curr, []))
    return result


@router.get("")
async def list_folders(
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    owner_id: uuid.UUID | None = None,
):
    vis_clause = await build_folder_visibility_clause(user, db)
    q = select(Folder).where(vis_clause)

    if owner_id:
        visible_owners = await get_visible_owner_ids(user, db)
        if visible_owners is not None and owner_id not in visible_owners:
            return []
        q = q.where(Folder.owner_id == owner_id)

    folders = (await db.scalars(q.order_by(Folder.name))).all()

    doc_vis_clause = await build_document_visibility_clause(user, db)
    doc_stats_q = select(
        Document.folder_id,
        func.count(Document.id).label("item_count"),
        func.max(Document.created_at).label("last_doc_at"),
    ).where(Document.folder_id.is_not(None), doc_vis_clause)
    if owner_id:
        doc_stats_q = doc_stats_q.where(Document.user_id == owner_id)
    doc_stats_rows = (await db.execute(doc_stats_q.group_by(Document.folder_id))).all()
    stats_by_folder = {row.folder_id: (int(row.item_count or 0), row.last_doc_at) for row in doc_stats_rows}

    subfolder_counts: dict[uuid.UUID, int] = {}
    for f in folders:
        if f.parent_id:
            subfolder_counts[f.parent_id] = subfolder_counts.get(f.parent_id, 0) + 1

    owner_map = await build_user_display_map(db, {f.owner_id for f in folders})

    results = []
    for f in folders:
        item_count, last_doc_at = stats_by_folder.get(f.id, (0, None))
        updated_at = f.updated_at
        if last_doc_at and (updated_at is None or last_doc_at > updated_at):
            updated_at = last_doc_at
        owner_info = owner_map.get(f.owner_id)
        can_manage = user.role == UserRole.ADMIN or (user.role != UserRole.VIEWER and f.owner_id == user.id)
        results.append(
            {
                "id": str(f.id),
                "name": f.name,
                "parent_id": str(f.parent_id) if f.parent_id else None,
                "path": f.path,
                "owner_id": str(f.owner_id),
                "owner_name": owner_info["display_name"] if owner_info else None,
                "owner_username": owner_info["username"] if owner_info else None,
                "owner_job_title": owner_info["job_title"] if owner_info else None,
                "can_manage": can_manage,
                "item_count": item_count,
                "subfolder_count": subfolder_counts.get(f.id, 0),
                "updated_at": updated_at.isoformat() if updated_at else None,
            }
        )
    return results


@router.post("", status_code=201)
async def create_folder(
    payload: FolderCreate,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if user.role == UserRole.VIEWER:
        raise HTTPException(403, "Viewer cannot create folders")
    parent = None
    if payload.parent_id:
        parent = await db.get(Folder, payload.parent_id)
        if not parent or parent.deleted_at is not None:
            raise HTTPException(404, "Parent folder not found")
        if (
            parent.owner_id != user.id
            and user.role != UserRole.ADMIN
            and not await db.scalar(
                select(FolderGrant.id).where(
                    FolderGrant.folder_id == parent.id,
                    FolderGrant.user_id == user.id,
                    FolderGrant.permission == "write",
                )
            )
        ):
            raise HTTPException(403, "Write access to parent folder required")
    name = validate_name(payload.name)
    await available_name(db, "folder", name, parent.id if parent else None, user.id)
    path = (parent.path.rstrip("/") + "/" + parent.name) if parent else "/"
    now = datetime.now(timezone.utc)
    folder = Folder(
        name=name,
        parent_id=parent.id if parent else None,
        owner_id=user.id,
        path=path or "/",
        updated_at=now,
    )
    if parent:
        parent.updated_at = now
    db.add(folder)
    await db.flush()
    db.add(AuditLog(actor_id=user.id, action="folder.created", resource_type="folder", resource_id=str(folder.id),
                    detail={"name": folder.name, "parent_id": str(folder.parent_id) if folder.parent_id else None}))
    await db.commit()
    await db.refresh(folder)
    display_name = (user.full_name or "").strip() or user.username
    return {
        "id": str(folder.id),
        "name": folder.name,
        "parent_id": str(folder.parent_id) if folder.parent_id else None,
        "path": folder.path,
        "owner_id": str(folder.owner_id),
        "owner_name": display_name,
        "owner_username": user.username,
        "owner_job_title": user.job_title,
        "can_manage": True,
        "item_count": 0,
        "subfolder_count": 0,
        "updated_at": folder.updated_at.isoformat() if folder.updated_at else now.isoformat(),
    }


@router.patch("/{folder_id}")
async def update_folder(
    folder_id: uuid.UUID,
    payload: FolderUpdate,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    folder = await db.scalar(select(Folder).where(Folder.id == folder_id).with_for_update())
    if not folder or folder.deleted_at is not None:
        raise HTTPException(404, "Folder not found")
    if user.role != UserRole.ADMIN and (user.role == UserRole.VIEWER or folder.owner_id != user.id):
        raise HTTPException(403, "Only folder owner or administrator can edit folders")
    old_name = folder.name
    if payload.name is not None:
        folder.name = validate_name(payload.name)
    if "parent_id" in payload.model_fields_set:
        if payload.parent_id is None:
            folder.parent_id = None
            folder.path = "/"
        else:
            if payload.parent_id == folder.id:
                raise HTTPException(422, "Folder cannot be its own parent")
            descendants = await _collect_descendant_folder_ids(db, folder.id)
            if payload.parent_id in descendants:
                raise HTTPException(422, "Cannot move folder into its own subfolder")
            new_parent = await db.get(Folder, payload.parent_id)
            if not new_parent or new_parent.deleted_at is not None:
                raise HTTPException(404, "Target parent folder not found")
            if user.role != UserRole.ADMIN and new_parent.owner_id != user.id:
                raise HTTPException(403, "Write access to target folder required")
            folder.parent_id = new_parent.id
            folder.path = new_parent.path.rstrip("/") + "/" + new_parent.name
    await available_name(db, "folder", folder.name, folder.parent_id, folder.owner_id, folder.id)
    if old_name != folder.name:
        # Refresh stored descendant paths; document breadcrumbs are calculated dynamically.
        all_folders = (await db.scalars(select(Folder))).all()
        by_id = {f.id: f for f in all_folders}
        def path_of(item, seen=None):
            seen = set() if seen is None else seen
            if item.id in seen or not item.parent_id or item.parent_id not in by_id: return "/"
            seen.add(item.id)
            parent = by_id[item.parent_id]
            return path_of(parent, seen).rstrip("/") + "/" + parent.name
        for item in all_folders: item.path = path_of(item)
    folder.updated_at = datetime.now(timezone.utc)
    db.add(AuditLog(actor_id=user.id, action="folder.renamed" if old_name != folder.name else "folder.updated", resource_type="folder", resource_id=str(folder.id),
                    detail={"name": folder.name, "parent_id": str(folder.parent_id) if folder.parent_id else None, **({"old_name": old_name, "new_name": folder.name} if old_name != folder.name else {})}))
    await db.commit()
    await db.refresh(folder)
    return {
        "id": str(folder.id),
        "name": folder.name,
        "parent_id": str(folder.parent_id) if folder.parent_id else None,
        "path": folder.path,
        "updated_at": folder.updated_at.isoformat() if folder.updated_at else None,
    }


@router.delete("/{folder_id}", status_code=204)
async def delete_folder(
    folder_id: uuid.UUID,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
):
    """Soft-delete folder and all nested subfolders/documents into the Recycle Bin."""
    folder = await db.get(Folder, folder_id)
    if not folder or folder.deleted_at is not None:
        raise HTTPException(404, "Folder not found")
    if user.role != UserRole.ADMIN and (user.role == UserRole.VIEWER or folder.owner_id != user.id):
        raise HTTPException(403, "Only folder owner or administrator can delete folders")

    now = datetime.now(timezone.utc)
    descendant_ids = await _collect_descendant_folder_ids(db, folder.id)
    nested_folders = (
        await db.scalars(select(Folder).where(Folder.id.in_(descendant_ids), Folder.deleted_at.is_(None)))
    ).all()
    for f in nested_folders:
        f.deleted_at = now
        f.deleted_by = user.id

    nested_docs = (
        await db.scalars(select(Document).where(Document.folder_id.in_(descendant_ids), Document.deleted_at.is_(None)))
    ).all()
    for d in nested_docs:
        d.deleted_at = now
        d.deleted_by = user.id

    db.add(
        AuditLog(
            actor_id=user.id,
            action="folder.trashed",
            resource_type="folder",
            resource_id=str(folder.id),
            detail={"name": folder.name, "subfolders": max(0, len(nested_folders) - 1), "documents": len(nested_docs)},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()
    return Response(status_code=204)


@router.put("/{folder_id}/grants")
async def set_grant(
    folder_id: uuid.UUID,
    payload: GrantCreate,
    actor: Annotated[User, Depends(admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    folder = await db.get(Folder, folder_id)
    if not folder or folder.deleted_at is not None:
        raise HTTPException(404, "Folder not found")
    if not await db.get(User, payload.user_id):
        raise HTTPException(404, "User not found")
    grant = await db.scalar(
        select(FolderGrant).where(FolderGrant.folder_id == folder_id, FolderGrant.user_id == payload.user_id)
    )
    if grant:
        grant.permission = payload.permission
    else:
        db.add(FolderGrant(folder_id=folder_id, user_id=payload.user_id, permission=payload.permission))
    db.add(AuditLog(actor_id=actor.id, action="folder.permissions_updated", resource_type="folder", resource_id=str(folder.id),
                    detail={"name": folder.name, "user_id": str(payload.user_id), "permission": payload.permission}))
    await db.commit()
    return {"folder_id": str(folder_id), "user_id": str(payload.user_id), "permission": payload.permission}


@router.get("/classifications")
async def classifications(user: Annotated[User, Depends(current_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    vis_clause = await build_document_visibility_clause(user, db)
    q = select(Document.classification).where(Document.classification.is_not(None), vis_clause)
    vals = (await db.scalars(q.distinct().order_by(Document.classification))).all()
    return [x for x in vals if x]


@router.get("/departments")
async def departments(user: Annotated[User, Depends(current_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    vis_clause = await build_document_visibility_clause(user, db)
    doc_q = select(Document.department).where(Document.department.is_not(None), vis_clause)
    doc_depts = (await db.scalars(doc_q.distinct())).all()
    combined = {d.strip() for d in doc_depts if d and d.strip()}
    if user.role == UserRole.ADMIN:
        user_depts = (await db.scalars(select(User.department).where(User.department.is_not(None)).distinct())).all()
        combined.update(d.strip() for d in user_depts if d and d.strip())
    elif user.department:
        combined.add(user.department.strip())
    return sorted(combined)
