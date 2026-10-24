import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.db import get_db
from app.models.document import Document
from app.models.user import User, UserRole
from app.services.gemini_service import AllGeminiKeysExhausted, GeminiOCRService, GeminiRequestFailed
from app.services.storage_service import get_storage

router = APIRouter()
MAX_UPLOAD_BYTES = 30 * 1024 * 1024
ALLOWED_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/webp", "image/tiff"}


@router.post("", status_code=202)
async def upload_document(file: Annotated[UploadFile, File()], user: Annotated[User, Depends(current_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(415, "Only PDF and supported image files are accepted")
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if not content or len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File is empty or exceeds the 30 MiB limit")
    # Check signatures rather than trusting Content-Type alone.
    valid = (file.content_type == "application/pdf" and content.startswith(b"%PDF-")) or (file.content_type == "image/jpeg" and content.startswith(b"\xff\xd8\xff")) or (file.content_type == "image/png" and content.startswith(b"\x89PNG\r\n\x1a\n")) or (file.content_type == "image/webp" and content[:4] == b"RIFF" and content[8:12] == b"WEBP") or (file.content_type == "image/tiff" and content[:4] in (b"II*\x00", b"MM\x00*"))
    if not valid:
        raise HTTPException(415, "File content does not match its declared type")
    doc_id = uuid.uuid4()
    safe_name = (file.filename or "document").replace("/", "_").replace("\\", "_")[:250]
    storage_key = f"{user.id}/{doc_id}"
    document = Document(id=doc_id, user_id=user.id, file_name=safe_name, file_path=storage_key, mime_type=file.content_type, file_size=len(content), processing_status="queued")
    db.add(document)
    await db.flush()
    try:
        await get_storage().put(storage_key, content, file.content_type)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(503, "Document storage is temporarily unavailable") from exc
    try:
        output = await GeminiOCRService().extract(content, file.content_type, user_key_encrypted=user.gemini_key_encrypted)
        document.extracted_text = output["extracted_text"]
        document.summary = output.get("summary")
        document.processed_by_key = output.get("processed_by_key")
        document.metadata_json = output.get("metadata", {}) | {"language": output.get("language"), "document_type": output.get("document_type")}
        document.processing_status = "completed"
    except AllGeminiKeysExhausted:
        document.processing_status = "queued"
        document.processing_error = "All OCR keys exhausted; awaiting retry"
    except GeminiRequestFailed:
        document.processing_status = "failed"
        document.processing_error = "OCR provider error; administrator review required"
    await db.commit()
    return {"id": str(doc_id), "file_name": safe_name, "status": document.processing_status}


@router.get("/{document_id}/file")
async def retrieve_document(document_id: uuid.UUID, user: Annotated[User, Depends(current_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    query = select(Document).where(Document.id == document_id)
    if user.role != UserRole.ADMIN:
        query = query.where(Document.user_id == user.id)
    document = await db.scalar(query)
    if not document:
        raise HTTPException(404, "Document not found")
    try:
        body = await get_storage().get(document.file_path)
    except Exception as exc:
        raise HTTPException(503, "Document storage is temporarily unavailable") from exc
    return Response(body, media_type=document.mime_type, headers={"Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache", "Content-Disposition": f'inline; filename="{document.file_name}"', "X-Content-Type-Options": "nosniff"})
