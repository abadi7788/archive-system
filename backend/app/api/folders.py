import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import admin_user, current_user
from app.db import get_db
from app.models.document import Document
from app.models.folder import Folder, FolderGrant
from app.models.user import User, UserRole

router = APIRouter()


class FolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    parent_id: uuid.UUID | None = None


class GrantCreate(BaseModel):
    user_id: uuid.UUID
    permission: str = Field(pattern="^(read|write)$")


@router.get("")
async def list_folders(user: Annotated[User, Depends(current_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    q = select(Folder)
    if user.role != UserRole.ADMIN:
        shared = select(FolderGrant.folder_id).where(FolderGrant.user_id == user.id)
        q = q.where(or_(Folder.owner_id == user.id, Folder.id.in_(shared)))
    folders = (await db.scalars(q.order_by(Folder.name))).all()

    doc_stats_q = select(
        Document.folder_id,
        func.count(Document.id).label("item_count"),
        func.max(Document.created_at).label("last_doc_at"),
    ).where(Document.folder_id.is_not(None))
    if user.role != UserRole.ADMIN:
        shared_ids = select(FolderGrant.folder_id).where(FolderGrant.user_id == user.id)
        doc_stats_q = doc_stats_q.where(or_(Document.user_id == user.id, Document.folder_id.in_(shared_ids)))
    doc_stats_rows = (await db.execute(doc_stats_q.group_by(Document.folder_id))).all()
    stats_by_folder = {row.folder_id: (int(row.item_count or 0), row.last_doc_at) for row in doc_stats_rows}

    subfolder_counts: dict[uuid.UUID, int] = {}
    for f in folders:
        if f.parent_id:
            subfolder_counts[f.parent_id] = subfolder_counts.get(f.parent_id, 0) + 1

    results = []
    for f in folders:
        item_count, last_doc_at = stats_by_folder.get(f.id, (0, None))
        updated_at = f.updated_at
        if last_doc_at and (updated_at is None or last_doc_at > updated_at):
            updated_at = last_doc_at
        results.append(
            {
                "id": str(f.id),
                "name": f.name,
                "parent_id": str(f.parent_id) if f.parent_id else None,
                "path": f.path,
                "owner_id": str(f.owner_id),
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
        if not parent:
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
    path = (parent.path.rstrip("/") + "/" + parent.name) if parent else "/"
    now = datetime.now(timezone.utc)
    folder = Folder(
        name=payload.name.strip(),
        parent_id=parent.id if parent else None,
        owner_id=user.id,
        path=path or "/",
        updated_at=now,
    )
    if parent:
        parent.updated_at = now
    db.add(folder)
    await db.commit()
    await db.refresh(folder)
    return {
        "id": str(folder.id),
        "name": folder.name,
        "parent_id": str(folder.parent_id) if folder.parent_id else None,
        "path": folder.path,
        "item_count": 0,
        "subfolder_count": 0,
        "updated_at": folder.updated_at.isoformat() if folder.updated_at else now.isoformat(),
    }


@router.delete("/{folder_id}", status_code=204)
async def delete_folder(
    folder_id: uuid.UUID,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    folder = await db.get(Folder, folder_id)
    if not folder:
        raise HTTPException(404, "Folder not found")
    if user.role != UserRole.ADMIN and folder.owner_id != user.id:
        raise HTTPException(403, "Only folder owner or administrator can delete folders")
    await db.delete(folder)
    await db.commit()
    return Response(status_code=204)


@router.put("/{folder_id}/grants")
async def set_grant(
    folder_id: uuid.UUID,
    payload: GrantCreate,
    _: Annotated[User, Depends(admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    folder = await db.get(Folder, folder_id)
    if not folder:
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
    await db.commit()
    return {"folder_id": str(folder_id), "user_id": str(payload.user_id), "permission": payload.permission}


@router.get("/classifications")
async def classifications(user: Annotated[User, Depends(current_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    q = select(Document.classification).where(Document.classification.is_not(None))
    if user.role != UserRole.ADMIN:
        shared = select(FolderGrant.folder_id).where(FolderGrant.user_id == user.id)
        q = q.where(or_(Document.user_id == user.id, Document.folder_id.in_(shared)))
    vals = (await db.scalars(q.distinct().order_by(Document.classification))).all()
    return [x for x in vals if x]


@router.get("/departments")
async def departments(user: Annotated[User, Depends(current_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    doc_q = select(Document.department).where(Document.department.is_not(None))
    if user.role != UserRole.ADMIN:
        shared = select(FolderGrant.folder_id).where(FolderGrant.user_id == user.id)
        doc_q = doc_q.where(or_(Document.user_id == user.id, Document.folder_id.in_(shared)))
    doc_depts = (await db.scalars(doc_q.distinct())).all()
    combined = {d.strip() for d in doc_depts if d and d.strip()}
    if user.role == UserRole.ADMIN:
        user_depts = (await db.scalars(select(User.department).where(User.department.is_not(None)).distinct())).all()
        combined.update(d.strip() for d in user_depts if d and d.strip())
    elif user.department:
        combined.add(user.department.strip())
    return sorted(combined)
