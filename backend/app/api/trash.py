import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import build_user_display_map
from app.api.deps import admin_user, current_user
from app.api.documents import build_folder_breadcrumbs, format_document_path
from app.api.folders import _collect_descendant_folder_ids
from app.db import get_db
from app.models.audit_log import AuditLog
from app.models.document import Document
from app.models.folder import Folder
from app.models.user import User, UserRole
from app.services.storage_service import get_storage

router = APIRouter()


@router.get("")
async def list_trash(
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    List soft-deleted folders and documents.
    Admin sees all trashed items; employees see only items they deleted (or own in trash).
    """
    doc_q = select(Document).where(Document.deleted_at.is_not(None))
    folder_q = select(Folder).where(Folder.deleted_at.is_not(None))
    if user.role != UserRole.ADMIN:
        doc_q = doc_q.where(or_(Document.deleted_by == user.id, Document.user_id == user.id))
        folder_q = folder_q.where(or_(Folder.deleted_by == user.id, Folder.owner_id == user.id))

    trashed_docs = (await db.scalars(doc_q.order_by(Document.deleted_at.desc()))).all()
    trashed_folders = (await db.scalars(folder_q.order_by(Folder.deleted_at.desc()))).all()

    user_ids: set[uuid.UUID] = set()
    for d in trashed_docs:
        user_ids.add(d.user_id)
        if d.deleted_by:
            user_ids.add(d.deleted_by)
    for f in trashed_folders:
        user_ids.add(f.owner_id)
        if f.deleted_by:
            user_ids.add(f.deleted_by)

    user_map = await build_user_display_map(db, user_ids)
    breadcrumbs = await build_folder_breadcrumbs(db)

    folder_items = []
    for f in trashed_folders:
        owner_info = user_map.get(f.owner_id)
        deleter_info = user_map.get(f.deleted_by) if f.deleted_by else None
        folder_items.append(
            {
                "id": str(f.id),
                "name": f.name,
                "parent_id": str(f.parent_id) if f.parent_id else None,
                "path": f.path,
                "owner_id": str(f.owner_id),
                "owner_name": owner_info["display_name"] if owner_info else None,
                "owner_username": owner_info["username"] if owner_info else None,
                "deleted_at": f.deleted_at.isoformat() if f.deleted_at else None,
                "deleted_by_name": deleter_info["display_name"] if deleter_info else None,
            }
        )

    doc_items = []
    for d in trashed_docs:
        owner_info = user_map.get(d.user_id)
        deleter_info = user_map.get(d.deleted_by) if d.deleted_by else None
        folder_breadcrumb, folder_path = format_document_path(d.folder_id, d.file_name, breadcrumbs)
        doc_items.append(
            {
                "id": str(d.id),
                "file_name": d.file_name,
                "mime_type": d.mime_type,
                "file_size": d.file_size,
                "classification": d.classification,
                "department": d.department,
                "folder_id": str(d.folder_id) if d.folder_id else None,
                "folder_breadcrumb": folder_breadcrumb,
                "folder_path": folder_path,
                "owner_id": str(d.user_id),
                "owner_name": owner_info["display_name"] if owner_info else None,
                "owner_username": owner_info["username"] if owner_info else None,
                "deleted_at": d.deleted_at.isoformat() if d.deleted_at else None,
                "deleted_by_name": deleter_info["display_name"] if deleter_info else None,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
        )

    return {
        "folders": folder_items,
        "documents": doc_items,
        "total_count": len(folder_items) + len(doc_items),
    }


@router.post("/documents/{document_id}/restore")
async def restore_document(
    document_id: uuid.UUID,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
):
    doc = await db.get(Document, document_id)
    if not doc or doc.deleted_at is None:
        raise HTTPException(404, "Trashed document not found")
    if user.role != UserRole.ADMIN and doc.deleted_by != user.id and doc.user_id != user.id:
        raise HTTPException(403, "You cannot restore this document")

    # If the original parent folder is still deleted, restore the document to root so it is reachable.
    if doc.folder_id:
        parent = await db.get(Folder, doc.folder_id)
        if not parent or parent.deleted_at is not None:
            doc.folder_id = None

    doc.deleted_at = None
    doc.deleted_by = None
    db.add(
        AuditLog(
            actor_id=user.id,
            action="document.restored",
            resource_type="document",
            resource_id=str(doc.id),
            detail={"file_name": doc.file_name},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()
    return {"id": str(doc.id), "restored": True}


@router.post("/folders/{folder_id}/restore")
async def restore_folder(
    folder_id: uuid.UUID,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
):
    folder = await db.get(Folder, folder_id)
    if not folder or folder.deleted_at is None:
        raise HTTPException(404, "Trashed folder not found")
    if user.role != UserRole.ADMIN and folder.deleted_by != user.id and folder.owner_id != user.id:
        raise HTTPException(403, "You cannot restore this folder")

    # If parent folder is still trashed, attach restored folder to root.
    if folder.parent_id:
        parent = await db.get(Folder, folder.parent_id)
        if not parent or parent.deleted_at is not None:
            folder.parent_id = None
            folder.path = "/"

    descendant_ids = await _collect_descendant_folder_ids(db, folder.id)
    nested_folders = (await db.scalars(select(Folder).where(Folder.id.in_(descendant_ids)))).all()
    for f in nested_folders:
        f.deleted_at = None
        f.deleted_by = None

    nested_docs = (
        await db.scalars(select(Document).where(Document.folder_id.in_(descendant_ids), Document.deleted_at.is_not(None)))
    ).all()
    for d in nested_docs:
        d.deleted_at = None
        d.deleted_by = None

    db.add(
        AuditLog(
            actor_id=user.id,
            action="folder.restored",
            resource_type="folder",
            resource_id=str(folder.id),
            detail={"name": folder.name, "restored_documents": len(nested_docs)},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()
    return {"id": str(folder.id), "restored": True}


@router.delete("/documents/{document_id}", status_code=204)
async def permanently_delete_document(
    document_id: uuid.UUID,
    actor: Annotated[User, Depends(admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
):
    """Admin-only permanent deletion of a trashed document and its stored file object."""
    doc = await db.get(Document, document_id)
    if not doc or doc.deleted_at is None:
        raise HTTPException(404, "Trashed document not found")
    key = doc.file_path
    name = doc.file_name
    db.add(
        AuditLog(
            actor_id=actor.id,
            action="document.permanently_deleted",
            resource_type="document",
            resource_id=str(doc.id),
            detail={"file_name": name},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.delete(doc)
    await db.commit()
    try:
        await get_storage().delete(key)
    except Exception:
        pass
    return Response(status_code=204)


@router.delete("/folders/{folder_id}", status_code=204)
async def permanently_delete_folder(
    folder_id: uuid.UUID,
    actor: Annotated[User, Depends(admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
):
    """Admin-only permanent deletion of a trashed folder and all nested contents."""
    folder = await db.get(Folder, folder_id)
    if not folder or folder.deleted_at is None:
        raise HTTPException(404, "Trashed folder not found")

    descendant_ids = await _collect_descendant_folder_ids(db, folder.id)
    nested_docs = (await db.scalars(select(Document).where(Document.folder_id.in_(descendant_ids)))).all()
    storage_keys = [d.file_path for d in nested_docs]
    for d in nested_docs:
        await db.delete(d)

    name = folder.name
    await db.delete(folder)
    db.add(
        AuditLog(
            actor_id=actor.id,
            action="folder.permanently_deleted",
            resource_type="folder",
            resource_id=str(folder_id),
            detail={"name": name, "documents_removed": len(storage_keys)},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()

    storage = get_storage()
    for key in storage_keys:
        try:
            await storage.delete(key)
        except Exception:
            pass
    return Response(status_code=204)


@router.delete("/empty")
async def empty_trash(
    actor: Annotated[User, Depends(admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
):
    """Admin-only action to permanently empty the entire Recycle Bin."""
    trashed_docs = (await db.scalars(select(Document).where(Document.deleted_at.is_not(None)))).all()
    trashed_folders = (await db.scalars(select(Folder).where(Folder.deleted_at.is_not(None)))).all()

    storage_keys = [d.file_path for d in trashed_docs]
    doc_count = len(trashed_docs)
    folder_count = len(trashed_folders)

    for d in trashed_docs:
        await db.delete(d)
    for f in trashed_folders:
        await db.delete(f)

    db.add(
        AuditLog(
            actor_id=actor.id,
            action="trash.emptied",
            resource_type="system",
            resource_id=None,
            detail={"documents_removed": doc_count, "folders_removed": folder_count},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()

    storage = get_storage()
    for key in storage_keys:
        try:
            await storage.delete(key)
        except Exception:
            pass

    return {"documents_removed": doc_count, "folders_removed": folder_count}
