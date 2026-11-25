import io
import logging
import re
import uuid
import zipfile
from datetime import date, datetime, time, timedelta, timezone
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
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
from app.models.taxonomy import DocumentStar
from app.models.user import User, UserRole
from app.services.gemini_service import AllGeminiKeysExhausted, GeminiOCRService, GeminiRequestFailed
from app.services.storage_service import get_storage

logger = logging.getLogger(__name__)

router = APIRouter()
MAX_UPLOAD_BYTES = 40 * 1024 * 1024
ALLOWED_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/webp", "image/tiff"}

MIME_ALIASES = {
    "image/jpg": "image/jpeg",
    "image/pjpeg": "image/jpeg",
    "image/x-png": "image/png",
    "application/x-pdf": "application/pdf",
}

MIME_EXT_MAP = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/tiff": ".tiff",
}


class BulkMovePayload(BaseModel):
    document_ids: list[uuid.UUID] = Field(min_length=1, max_length=100)
    folder_id: uuid.UUID | None = None


class BulkIdsPayload(BaseModel):
    document_ids: list[uuid.UUID] = Field(min_length=1, max_length=100)


def _detect_mime_type(content: bytes, declared_mime: str | None) -> str | None:
    """Detect canonical MIME type from file magic bytes, resilient to Windows/browser MIME quirks."""
    if len(content) >= 5 and content[:5] == b"%PDF-":
        return "application/pdf"
    if len(content) >= 3 and content[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if len(content) >= 8 and content[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    if len(content) >= 4 and content[:4] in (b"II*\x00", b"MM\x00*"):
        return "image/tiff"
    # PDF files occasionally contain small leading whitespace or BOM before %PDF-
    if b"%PDF-" in content[:1024]:
        return "application/pdf"
    normalized = MIME_ALIASES.get((declared_mime or "").strip().lower(), (declared_mime or "").strip().lower())
    if normalized in ALLOWED_TYPES:
        return None  # Declared type didn't match file signature
    return None


def _build_content_disposition(file_name: str, mime_type: str, inline: bool = True) -> str:
    """Build RFC 5987 UTF-8 safe Content-Disposition header so Arabic/Unicode filenames never fail."""
    disposition = "inline" if inline else "attachment"
    clean_name = (file_name or "document").replace("\r", "").replace("\n", "").replace('"', "_")
    ascii_fallback = re.sub(r"[^A-Za-z0-9._-]", "_", clean_name).strip("._")
    ext = MIME_EXT_MAP.get(mime_type, "")
    if not ascii_fallback:
        ascii_fallback = f"document{ext}"
    elif ext and "." not in ascii_fallback:
        ascii_fallback = f"{ascii_fallback}{ext}"
    encoded = quote(clean_name, safe="")
    return f'{disposition}; filename="{ascii_fallback}"; filename*=UTF-8\'\'{encoded}'


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


async def _can_write_folder(folder: Folder, user: User, db: AsyncSession) -> bool:
    if user.role == UserRole.VIEWER:
        return False
    if folder.owner_id == user.id or user.role == UserRole.ADMIN:
        return True
    return bool(
        await db.scalar(
            select(FolderGrant.id).where(
                FolderGrant.folder_id == folder.id,
                FolderGrant.user_id == user.id,
                FolderGrant.permission == "write",
            )
        )
    )


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
    """Background task that runs text extraction and stores searchable text."""
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
@router.post("/upload", status_code=201)
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

    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if not content or len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File is empty or exceeds the 40 MiB limit")

    detected_mime = _detect_mime_type(content, file.content_type)
    if not detected_mime or detected_mime not in ALLOWED_TYPES:
        raise HTTPException(415, "Only PDF and supported image files (JPG, PNG, WEBP, TIFF) are accepted")

    folder = None
    if folder_id and folder_id.strip():
        try:
            folder = await db.get(Folder, uuid.UUID(folder_id.strip()))
        except ValueError:
            raise HTTPException(422, "Invalid folder id")
        if not folder or folder.deleted_at is not None:
            raise HTTPException(404, "Folder not found")
        if not await _can_write_folder(folder, user, db):
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
        mime_type=detected_mime,
        file_size=len(content),
        processing_status="queued",
    )
    db.add(doc)
    await db.flush()
    try:
        await get_storage().put(key, content, detected_mime)
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to store uploaded document %s: %s", did, type(exc).__name__)
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

    background_tasks.add_task(run_ocr_background, did, key, detected_mime, user.gemini_key_encrypted)

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
        "is_starred": False,
        "created_at": doc.created_at,
        "metadata": doc.metadata_json,
    }


@router.post("/bulk/move")
async def bulk_move_documents(
    payload: BulkMovePayload,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
):
    if user.role == UserRole.VIEWER:
        raise HTTPException(403, "Viewer accounts cannot move documents")

    target_folder = None
    if payload.folder_id is not None:
        target_folder = await db.get(Folder, payload.folder_id)
        if not target_folder or target_folder.deleted_at is not None:
            raise HTTPException(404, "Target folder not found")
        if not await _can_write_folder(target_folder, user, db):
            raise HTTPException(403, "Write access to target folder required")

    unique_ids = list(dict.fromkeys(payload.document_ids))
    docs = (
        await db.scalars(
            select(Document).where(Document.id.in_(unique_ids), Document.deleted_at.is_(None))
        )
    ).all()

    moved = 0
    skipped = 0
    for doc in docs:
        if not await _can_write_doc(doc, user, db):
            skipped += 1
            continue
        doc.folder_id = target_folder.id if target_folder else None
        moved += 1

    if moved > 0:
        if target_folder:
            target_folder.updated_at = datetime.now(timezone.utc)
        db.add(
            AuditLog(
                actor_id=user.id,
                action="document.bulk_moved",
                resource_type="document",
                resource_id=str(target_folder.id) if target_folder else "root",
                detail={"moved": moved, "skipped": skipped, "folder_id": str(target_folder.id) if target_folder else None},
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
            )
        )
        await db.commit()

    return {"moved": moved, "skipped": skipped}


@router.post("/bulk/trash")
async def bulk_trash_documents(
    payload: BulkIdsPayload,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
):
    if user.role == UserRole.VIEWER:
        raise HTTPException(403, "Viewer accounts cannot delete documents")

    unique_ids = list(dict.fromkeys(payload.document_ids))
    docs = (
        await db.scalars(
            select(Document).where(Document.id.in_(unique_ids), Document.deleted_at.is_(None))
        )
    ).all()

    trashed = 0
    skipped = 0
    now = datetime.now(timezone.utc)
    for doc in docs:
        if not await _can_write_doc(doc, user, db):
            skipped += 1
            continue
        doc.deleted_at = now
        doc.deleted_by = user.id
        trashed += 1

    if trashed > 0:
        db.add(
            AuditLog(
                actor_id=user.id,
                action="document.bulk_trashed",
                resource_type="document",
                resource_id=f"batch:{trashed}",
                detail={"trashed": trashed, "skipped": skipped},
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
            )
        )
        await db.commit()

    return {"trashed": trashed, "skipped": skipped}


@router.post("/bulk/download-zip")
async def bulk_download_zip(
    payload: BulkIdsPayload,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
):
    unique_ids = list(dict.fromkeys(payload.document_ids))[:50]
    vis_clause = await build_document_visibility_clause(user, db)
    docs = (
        await db.scalars(select(Document).where(Document.id.in_(unique_ids), vis_clause))
    ).all()
    if not docs:
        raise HTTPException(404, "No accessible documents selected")

    storage = get_storage()
    buffer = io.BytesIO()
    used_names: dict[str, int] = {}
    included = 0

    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for doc in docs:
            try:
                raw = await storage.get(doc.file_path)
            except Exception as exc:
                logger.warning("Skipping missing/unreadable file %s during bulk ZIP: %s", doc.id, type(exc).__name__)
                continue
            safe_name = (doc.file_name or f"document-{doc.id}").replace("/", "_").replace("\\", "_")
            count = used_names.get(safe_name.lower(), 0)
            used_names[safe_name.lower()] = count + 1
            if count > 0:
                if "." in safe_name:
                    stem, ext = safe_name.rsplit(".", 1)
                    safe_name = f"{stem}_{count}.{ext}"
                else:
                    safe_name = f"{safe_name}_{count}"
            zf.writestr(safe_name, raw)
            included += 1

    if included == 0:
        raise HTTPException(503, "Selected documents could not be read from storage")

    db.add(
        AuditLog(
            actor_id=user.id,
            action="document.bulk_downloaded_zip",
            resource_type="document",
            resource_id=f"batch:{included}",
            detail={"count": included},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
    return Response(
        buffer.getvalue(),
        media_type="application/zip",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
            "Content-Disposition": f'attachment; filename="archive-files-{stamp}.zip"',
            "X-Content-Type-Options": "nosniff",
        },
    )


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
    starred_only: bool = False,
    from_date: str | None = None,
    to_date: str | None = None,
    keyword: str | None = None,
    limit: int = 100,
):
    if not 1 <= limit <= 250:
        raise HTTPException(422, "Limit must be 1-250")
    vis_clause = await build_document_visibility_clause(user, db)
    q = select(Document).where(vis_clause)

    starred_ids = set(
        (await db.scalars(select(DocumentStar.document_id).where(DocumentStar.user_id == user.id))).all()
    )
    if starred_only:
        if not starred_ids:
            return []
        q = q.where(Document.id.in_(starred_ids))

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
    elif root_only and not starred_only:
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
                "is_starred": d.id in starred_ids,
                "created_at": d.created_at,
            }
        )
    return results


@router.post("/{document_id}/star")
async def toggle_star_document(
    document_id: uuid.UUID,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    vis_clause = await build_document_visibility_clause(user, db)
    doc = await db.scalar(select(Document).where(Document.id == document_id, vis_clause))
    if not doc:
        raise HTTPException(404, "Document not found")

    existing = await db.scalar(
        select(DocumentStar).where(
            DocumentStar.user_id == user.id,
            DocumentStar.document_id == document_id,
        )
    )
    if existing:
        await db.execute(
            delete(DocumentStar).where(
                DocumentStar.user_id == user.id,
                DocumentStar.document_id == document_id,
            )
        )
        await db.commit()
        return {"document_id": str(document_id), "is_starred": False}

    db.add(DocumentStar(user_id=user.id, document_id=document_id))
    await db.commit()
    return {"document_id": str(document_id), "is_starred": True}


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
    is_starred = bool(
        await db.scalar(
            select(DocumentStar.document_id).where(
                DocumentStar.user_id == user.id,
                DocumentStar.document_id == doc.id,
            )
        )
    )
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
        "is_starred": is_starred,
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
                if not await _can_write_folder(folder, user, db):
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
@router.get("/{document_id}/download")
async def retrieve_document(
    document_id: uuid.UUID,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
    inline: bool = True,
):
    vis_clause = await build_document_visibility_clause(user, db)
    doc = await db.scalar(select(Document).where(Document.id == document_id, vis_clause))
    if not doc:
        raise HTTPException(404, "Document not found")
    try:
        body = await get_storage().get(doc.file_path)
    except Exception as exc:
        logger.error("Failed to retrieve document %s from storage: %s", doc.id, type(exc).__name__)
        raise HTTPException(503, "Document storage is temporarily unavailable") from exc
    db.add(
        AuditLog(
            actor_id=user.id,
            action="document.downloaded",
            resource_type="document",
            resource_id=str(doc.id),
            detail={"inline": inline},
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
            "Content-Disposition": _build_content_disposition(doc.file_name, doc.mime_type, inline=inline),
            "X-Content-Type-Options": "nosniff",
        },
    )
