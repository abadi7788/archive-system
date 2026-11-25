import logging
import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import (
    build_document_visibility_clause,
    build_user_display_map,
    get_visible_owner_ids,
)
from app.api.deps import current_user
from app.db import SessionLocal, get_db
from app.models.audit_log import AuditLog
from app.models.document import Document
from app.models.folder import Folder, FolderGrant
from app.models.user import User, UserRole
from app.services.gemini_service import AllGeminiKeysExhausted, GeminiOCRService, GeminiRequestFailed
from app.services.storage_service import get_storage

logger = logging.getLogger(__name__)

router = APIRouter()
MAX_UPLOAD_BYTES = 30 * 1024 * 1024
ALLOWED_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/webp", "image/tiff"}


async def _can_write_doc(doc: Document, user: User, db: AsyncSession) -> bool:
    if user.role == UserRole.VIEWER:
        return False
    if user.role == UserRole.ADMIN or doc.user_id == user.id:
        return True
    if doc.folder_id:
        return bool(
            await db.scalar(
                select(FolderGrant.id).where(
                    FolderGrant.folder_id == doc.folder_id,
                    FolderGrant.user_id == user.id,
                    FolderGrant.permission == "write",
                )
            )
        )
    return False


async def build_folder_breadcrumbs(db: AsyncSession) -> dict[uuid.UUID, str]:
    """Resolve hierarchy breadcrumb string for every folder id."""
    rows = (await db.execute(select(Folder.id, Folder.name, Folder.parent_id))).all()
    by_id = {row.id: (row.name, row.parent_id) for row in rows}
    resolved: dict[uuid.UUID, str] = {}

    def resolve(fid: uuid.UUID) -> str:
        if fid in resolved:
            return resolved[fid]
        parts: list[str] = []
        seen: set[uuid.UUID] = set()
        curr: uuid.UUID | None = fid
        while curr and curr in by_id and curr not in seen:
            seen.add(curr)
            name, parent_id = by_id[curr]
            parts.append(name)
            curr = parent_id
        parts.reverse()
        crumb = " / ".join(parts) if parts else ""
        resolved[fid] = crumb
        return crumb

    for fid in by_id:
        resolve(fid)
    return resolved


def format_document_path(folder_id: uuid.UUID | None, file_name: str, breadcrumbs: dict[uuid.UUID, str]) -> tuple[str, str]:
    crumb = breadcrumbs.get(folder_id, "") if folder_id else ""
    if crumb:
        return crumb, f"{crumb} / {file_name}"
    return "", file_name


async def run_ocr_background(
    document_id: uuid.UUID,
    storage_key: str,
    mime_type: str,
    user_key_encrypted: str | None = None,
) -> None:
    """Background task that runs Gemini 2.5 Flash extraction and stores searchable text."""
    async with SessionLocal() as session:
        doc = await session.get(Document, document_id)
        if not doc or doc.deleted_at is not None:
            return
        try:
            doc.processing_status = "processing"
            await session.commit()
            content = await get_storage().get(storage_key)
            out = await GeminiOCRService().extract(content, mime_type, user_key_encrypted=user_key_encrypted)
            doc.extracted_text = out["extracted_text"]
            doc.summary = out.get("summary") or doc.summary
            doc.processed_by_key = out.get("processed_by_key")
            doc.classification = doc.classification or out.get("classification") or out.get("document_type")
            extracted_keywords = out.get("keywords") or out.get("metadata", {}).get("keywords", [])
            if extracted_keywords and not doc.keywords:
                doc.keywords = extracted_keywords
            doc.metadata_json = (doc.metadata_json or {}) | out.get("metadata", {}) | {
                "language": out.get("language"),
                "document_type": out.get("document_type"),
                "keywords": doc.keywords,
            }
            doc.department = doc.department or out.get("metadata", {}).get("department")
            doc.processing_status = "completed"
            doc.processing_error = None
        except AllGeminiKeysExhausted:
            doc.processing_status = "queued"
            doc.processing_error = "Extraction keys currently rate limited; awaiting retry"
        except GeminiRequestFailed:
            doc.processing_status = "failed"
            doc.processing_error = "Text extraction provider error; administrator review required"
        except Exception as exc:
            logger.warning("Background extraction failed for document %s (%s)", document_id, type(exc).__name__)
            doc.processing_status = "failed"
            doc.processing_error = "Background text extraction failed"
        await session.commit()


async def run_ocr_batch_background(document_jobs: list[tuple[uuid.UUID, str, str, str | None]]) -> None:
    """Sequentially re-index queued documents in the background without overwhelming quotas."""
    for doc_id, storage_key, mime_type, user_key_encrypted in document_jobs:
        await run_ocr_background(doc_id, storage_key, mime_type, user_key_encrypted)


@router.post("", status_code=201)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: Annotated[UploadFile, File()],
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
    folder_id: Annotated[str | None, Form()] = None,
    department: Annotated[str | None, Form()] = None,
    classification: Annotated[str | None, Form()] = None,
    keywords: Annotated[str | None, Form()] = None,
    summary: Annotated[str | None, Form()] = None,
):
    if user.role == UserRole.VIEWER:
        raise HTTPException(403, "Viewer accounts cannot upload or modify documents")
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(415, "Only PDF and supported image files are accepted")
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if not content or len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File is empty or exceeds the 30 MiB limit")
    valid = (
        (file.content_type == "application/pdf" and content.startswith(b"%PDF-"))
        or (file.content_type == "image/jpeg" and content.startswith(b"\xff\xd8\xff"))
        or (file.content_type == "image/png" and content.startswith(b"\x89PNG\r\n\x1a\n"))
        or (file.content_type == "image/webp" and content[:4] == b"RIFF" and content[8:12] == b"WEBP")
        or (file.content_type == "image/tiff" and content[:4] in (b"II*\x00", b"MM\x00*"))
    )
    if not valid:
        raise HTTPException(415, "File content does not match its declared type")
    folder = None
    if folder_id:
        try:
            folder = await db.get(Folder, uuid.UUID(folder_id))
        except ValueError:
            raise HTTPException(422, "Invalid folder id")
        if not folder or folder.deleted_at is not None:
            raise HTTPException(404, "Folder not found")
        allowed = (
            folder.owner_id == user.id
            or user.role == UserRole.ADMIN
            or bool(
                await db.scalar(
                    select(FolderGrant.id).where(
                        FolderGrant.folder_id == folder.id,
                        FolderGrant.user_id == user.id,
                        FolderGrant.permission == "write",
                    )
                )
            )
        )
        if not allowed:
            raise HTTPException(403, "Write access to this folder is required")

    parsed_keywords = [k.strip() for k in (keywords or "").split(",") if k.strip()][:50]
    did = uuid.uuid4()
    name = (file.filename or "document").replace("/", "_").replace("\\", "_")[:250]
    key = f"{user.id}/{did}"
    doc = Document(
        id=did,
        user_id=user.id,
        folder_id=folder.id if folder else None,
        department=(department.strip() if department and department.strip() else user.department),
        classification=(classification.strip() if classification and classification.strip() else None),
        summary=(summary.strip() if summary and summary.strip() else None),
        keywords=parsed_keywords,
        file_name=name,
        file_path=key,
        mime_type=file.content_type,
        file_size=len(content),
        processing_status="queued",
    )
    db.add(doc)
    await db.flush()
    try:
        await get_storage().put(key, content, file.content_type)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(503, "Document storage is temporarily unavailable") from exc

    if folder:
        folder.updated_at = datetime.now(timezone.utc)

    db.add(
        AuditLog(
            actor_id=user.id,
            action="document.uploaded",
            resource_type="document",
            resource_id=str(did),
            detail={
                "file_name": name,
                "size": len(content),
                "status": "queued",
                "folder_id": str(folder.id) if folder else None,
            },
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()

    background_tasks.add_task(run_ocr_background, did, key, file.content_type, user.gemini_key_encrypted)

    breadcrumbs = await build_folder_breadcrumbs(db)
    folder_breadcrumb, folder_path = format_document_path(doc.folder_id, name, breadcrumbs)
    owner_name = (user.full_name or "").strip() or user.username
    return {
        "id": str(did),
        "file_name": name,
        "mime_type": doc.mime_type,
        "file_size": doc.file_size,
        "status": doc.processing_status,
        "extracted_text": doc.extracted_text or "",
        "summary": doc.summary,
        "classification": doc.classification,
        "department": doc.department,
        "keywords": doc.keywords,
        "folder_id": str(doc.folder_id) if doc.folder_id else None,
        "folder_breadcrumb": folder_breadcrumb,
        "folder_path": folder_path,
        "owner_id": str(user.id),
        "owner_name": owner_name,
        "owner_username": user.username,
        "owner_job_title": user.job_title,
        "can_manage": True,
        "created_at": doc.created_at,
        "metadata": doc.metadata_json,
    }


@router.get("")
async def list_documents(
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    department: str | None = None,
    mime_type: str | None = None,
    classification: str | None = None,
    folder_id: uuid.UUID | None = None,
    owner_id: uuid.UUID | None = None,
    root_only: bool = False,
    from_date: str | None = None,
    to_date: str | None = None,
    keyword: str | None = None,
    limit: int = 100,
):
    if not 1 <= limit <= 250:
        raise HTTPException(422, "Limit must be 1-250")
    vis_clause = await build_document_visibility_clause(user, db)
    q = select(Document).where(vis_clause)

    if owner_id:
        visible_owners = await get_visible_owner_ids(user, db)
        if visible_owners is not None and owner_id not in visible_owners:
            return []
        q = q.where(Document.user_id == owner_id)

    if department:
        q = q.where(Document.department == department)
    if mime_type:
        q = q.where(Document.mime_type == mime_type)
    if classification:
        q = q.where(Document.classification == classification)
    if folder_id:
        q = q.where(Document.folder_id == folder_id)
    elif root_only:
        q = q.where(Document.folder_id.is_(None))
    if from_date:
        try:
            q = q.where(Document.created_at >= datetime.combine(date.fromisoformat(from_date), time.min, tzinfo=timezone.utc))
        except ValueError:
            raise HTTPException(422, "from_date must use YYYY-MM-DD")
    if to_date:
        try:
            q = q.where(Document.created_at < datetime.combine(date.fromisoformat(to_date) + timedelta(days=1), time.min, tzinfo=timezone.utc))
        except ValueError:
            raise HTTPException(422, "to_date must use YYYY-MM-DD")
    if keyword:
        q = q.where(Document.keywords.contains([keyword]))
    rows = (await db.scalars(q.order_by(Document.created_at.desc()).limit(limit))).all()
    breadcrumbs = await build_folder_breadcrumbs(db)
    owner_map = await build_user_display_map(db, {d.user_id for d in rows})

    results = []
    for d in rows:
        folder_breadcrumb, folder_path = format_document_path(d.folder_id, d.file_name, breadcrumbs)
        owner_info = owner_map.get(d.user_id)
        can_manage = user.role == UserRole.ADMIN or (user.role != UserRole.VIEWER and d.user_id == user.id)
        results.append(
            {
                "id": str(d.id),
                "file_name": d.file_name,
                "mime_type": d.mime_type,
                "file_size": d.file_size,
                "summary": d.summary,
                "snippet": (d.extracted_text or "")[:350],
                "extracted_text": (d.extracted_text or "")[:600],
                "status": d.processing_status,
                "classification": d.classification,
                "department": d.department,
                "keywords": d.keywords,
                "folder_id": str(d.folder_id) if d.folder_id else None,
                "folder_breadcrumb": folder_breadcrumb,
                "folder_path": folder_path,
                "owner_id": str(d.user_id),
                "owner_name": owner_info["display_name"] if owner_info else None,
                "owner_username": owner_info["username"] if owner_info else None,
                "owner_job_title": owner_info["job_title"] if owner_info else None,
                "can_manage": can_manage,
                "created_at": d.created_at,
            }
        )
    return results


@router.get("/{document_id}")
async def document_details(
    document_id: uuid.UUID,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
):
    vis_clause = await build_document_visibility_clause(user, db)
    doc = await db.scalar(select(Document).where(Document.id == document_id, vis_clause))
    if not doc:
        raise HTTPException(404, "Document not found")
    breadcrumbs = await build_folder_breadcrumbs(db)
    folder_breadcrumb, folder_path = format_document_path(doc.folder_id, doc.file_name, breadcrumbs)
    owner_map = await build_user_display_map(db, {doc.user_id})
    owner_info = owner_map.get(doc.user_id)
    can_manage = await _can_write_doc(doc, user, db)
    db.add(
        AuditLog(
            actor_id=user.id,
            action="document.opened",
            resource_type="document",
            resource_id=str(doc.id),
            detail={},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()
    return {
        "id": str(doc.id),
        "file_name": doc.file_name,
        "mime_type": doc.mime_type,
        "file_size": doc.file_size,
        "extracted_text": doc.extracted_text,
        "summary": doc.summary,
        "classification": doc.classification,
        "department": doc.department,
        "keywords": doc.keywords,
        "folder_id": str(doc.folder_id) if doc.folder_id else None,
        "folder_breadcrumb": folder_breadcrumb,
        "folder_path": folder_path,
        "owner_id": str(doc.user_id),
        "owner_name": owner_info["display_name"] if owner_info else None,
        "owner_username": owner_info["username"] if owner_info else None,
        "owner_job_title": owner_info["job_title"] if owner_info else None,
        "can_manage": can_manage,
        "metadata": doc.metadata_json,
        "status": doc.processing_status,
        "created_at": doc.created_at,
    }


@router.patch("/{document_id}")
async def edit_document(
    document_id: uuid.UUID,
    payload: dict,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
):
    doc = await db.get(Document, document_id)
    if not doc or doc.deleted_at is not None:
        raise HTTPException(404, "Document not found")
    if not await _can_write_doc(doc, user, db):
        raise HTTPException(403, "You cannot edit this document")
    allowed = {"file_name", "department", "classification", "keywords", "summary", "folder_id"}
    changes = []
    for key, value in payload.items():
        if key not in allowed:
            raise HTTPException(422, f"Field cannot be edited: {key}")
        if key == "folder_id":
            if not value:
                doc.folder_id = None
            else:
                try:
                    fid = uuid.UUID(str(value))
                except Exception:
                    raise HTTPException(422, "Invalid folder id")
                folder = await db.get(Folder, fid)
                if not folder or folder.deleted_at is not None:
                    raise HTTPException(404, "Folder not found")
                if (
                    folder.owner_id != user.id
                    and user.role != UserRole.ADMIN
                    and not await db.scalar(
                        select(FolderGrant.id).where(
                            FolderGrant.folder_id == fid,
                            FolderGrant.user_id == user.id,
                            FolderGrant.permission == "write",
                        )
                    )
                ):
                    raise HTTPException(403, "Write access to target folder required")
                doc.folder_id = fid
                folder.updated_at = datetime.now(timezone.utc)
        elif key == "file_name":
            if not isinstance(value, str) or not value.strip():
                raise HTTPException(422, "file_name cannot be empty")
            doc.file_name = value.strip().replace("/", "_").replace("\\", "_")[:250]
        elif key == "keywords":
            if not isinstance(value, list) or len(value) > 50 or not all(isinstance(item, str) and len(item) <= 80 for item in value):
                raise HTTPException(422, "keywords must be a list of up to 50 short strings")
            doc.keywords = [item.strip() for item in value if item.strip()]
        else:
            if value is not None and not isinstance(value, str):
                raise HTTPException(422, f"Invalid value for {key}")
            cleaned = value.strip() if isinstance(value, str) else None
            setattr(doc, key, cleaned or None)
        changes.append(key)
    if "keywords" in changes:
        doc.metadata_json = {**(doc.metadata_json or {}), "keywords": doc.keywords}
    if "classification" in changes:
        doc.metadata_json = {**(doc.metadata_json or {}), "classification": doc.classification}
    db.add(
        AuditLog(
            actor_id=user.id,
            action="document.edited",
            resource_type="document",
            resource_id=str(doc.id),
            detail={"fields": changes},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()
    breadcrumbs = await build_folder_breadcrumbs(db)
    folder_breadcrumb, folder_path = format_document_path(doc.folder_id, doc.file_name, breadcrumbs)
    return {
        "id": str(doc.id),
        "file_name": doc.file_name,
        "classification": doc.classification,
        "department": doc.department,
        "summary": doc.summary,
        "keywords": doc.keywords,
        "folder_id": str(doc.folder_id) if doc.folder_id else None,
        "folder_breadcrumb": folder_breadcrumb,
        "folder_path": folder_path,
    }


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: uuid.UUID,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
):
    """Soft-delete document by moving it to the Recycle Bin."""
    doc = await db.get(Document, document_id)
    if not doc or doc.deleted_at is not None:
        raise HTTPException(404, "Document not found")
    if not await _can_write_doc(doc, user, db):
        raise HTTPException(403, "You cannot delete this document")
    doc.deleted_at = datetime.now(timezone.utc)
    doc.deleted_by = user.id
    db.add(
        AuditLog(
            actor_id=user.id,
            action="document.trashed",
            resource_type="document",
            resource_id=str(doc.id),
            detail={"file_name": doc.file_name},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()
    return Response(status_code=204)


@router.get("/{document_id}/file")
async def retrieve_document(
    document_id: uuid.UUID,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
):
    vis_clause = await build_document_visibility_clause(user, db)
    doc = await db.scalar(select(Document).where(Document.id == document_id, vis_clause))
    if not doc:
        raise HTTPException(404, "Document not found")
    try:
        body = await get_storage().get(doc.file_path)
    except Exception as exc:
        raise HTTPException(503, "Document storage is temporarily unavailable") from exc
    db.add(
        AuditLog(
            actor_id=user.id,
            action="document.downloaded",
            resource_type="document",
            resource_id=str(doc.id),
            detail={},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()
    return Response(
        body,
        media_type=doc.mime_type,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
            "Pragma": "no-cache",
            "Content-Disposition": f'inline; filename="{doc.file_name}"',
            "X-Content-Type-Options": "nosniff",
        },
    )
