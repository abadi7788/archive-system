import hashlib
import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field, SecretStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import build_document_visibility_clause
from app.api.deps import current_user
from app.api.documents import _can_write_doc
from app.core.security import hash_password, verify_password
from app.db import get_db
from app.models.audit_log import AuditLog
from app.models.document import Document
from app.models.share_link import ShareLink
from app.models.user import User
from app.services.gemini_service import AllGeminiKeysExhausted, GeminiOCRService, GeminiRequestFailed
from app.services.storage_service import get_storage

router = APIRouter()


class ChatQuestion(BaseModel):
    question: str = Field(min_length=1, max_length=2000)


class ShareCreate(BaseModel):
    password: SecretStr = Field(min_length=6, max_length=200)
    expires_in_hours: int = Field(default=24, ge=1, le=720)


class SharePassword(BaseModel):
    password: SecretStr


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@router.post("/documents/{document_id}/chat")
async def chat_with_document(
    document_id: uuid.UUID,
    payload: ChatQuestion,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
):
    vis = await build_document_visibility_clause(user, db)
    doc = await db.scalar(select(Document).where(Document.id == document_id, vis))
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.processing_status != "completed" or not doc.extracted_text:
        raise HTTPException(409, "Document text indexing is not ready yet")
    try:
        answer = await GeminiOCRService().ask_document(
            payload.question, doc.extracted_text, user_key_encrypted=user.gemini_key_encrypted
        )
    except AllGeminiKeysExhausted as exc:
        raise HTTPException(503, "Service is currently rate limited") from exc
    except GeminiRequestFailed as exc:
        raise HTTPException(502, "Document query service is temporarily unavailable") from exc
    db.add(
        AuditLog(
            actor_id=user.id,
            action="document.chat",
            resource_type="document",
            resource_id=str(doc.id),
            detail={"question_length": len(payload.question)},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()
    return answer


@router.post("/documents/{document_id}/share", status_code=201)
async def create_share(
    document_id: uuid.UUID,
    payload: ShareCreate,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
):
    doc = await db.get(Document, document_id)
    if not doc or doc.deleted_at is not None:
        raise HTTPException(404, "Document not found")
    if not await _can_write_doc(doc, user, db):
        raise HTTPException(403, "Write access required to share a document")
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=payload.expires_in_hours)
    try:
        pw_hash = hash_password(payload.password.get_secret_value())
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    link = ShareLink(
        document_id=doc.id,
        created_by=user.id,
        token_hash=_token_hash(token),
        password_hash=pw_hash,
        expires_at=expires,
    )
    db.add(link)
    db.add(
        AuditLog(
            actor_id=user.id,
            action="document.share_created",
            resource_type="document",
            resource_id=str(doc.id),
            detail={"expires_at": expires.isoformat()},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()
    return {
        "share_token": token,
        "expires_at": expires,
        "document_id": str(doc.id),
        "note": "Keep the token private; the password is required to access this link.",
    }


async def _validated_share(token: str, password: str, db: AsyncSession) -> tuple[ShareLink, Document]:
    link = await db.scalar(
        select(ShareLink).where(ShareLink.token_hash == _token_hash(token), ShareLink.is_active.is_(True))
    )
    now = datetime.now(timezone.utc)
    if not link or link.expires_at <= now:
        raise HTTPException(404, "Share link is invalid or expired")
    if link.locked_until and link.locked_until > now:
        raise HTTPException(429, "Share link temporarily locked")
    if not verify_password(password, link.password_hash):
        link.failed_attempts += 1
        if link.failed_attempts >= 5:
            link.failed_attempts = 0
            link.locked_until = now + timedelta(minutes=15)
        await db.commit()
        raise HTTPException(401, "Incorrect share password")
    link.failed_attempts = 0
    link.locked_until = None
    doc = await db.get(Document, link.document_id)
    if not doc or doc.deleted_at is not None:
        raise HTTPException(404, "Document not found")
    return link, doc


@router.post("/shared/{token}/details")
async def shared_details(
    token: str,
    payload: SharePassword,
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
):
    link, doc = await _validated_share(token, payload.password.get_secret_value(), db)
    db.add(
        AuditLog(
            actor_id=None,
            action="document.shared_opened",
            resource_type="document",
            resource_id=str(doc.id),
            detail={"share_id": str(link.id), "actor": "share-link guest"},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()
    return Response(
        content=json.dumps(
            {
                "file_name": doc.file_name,
                "mime_type": doc.mime_type,
                "summary": doc.summary,
                "extracted_text": doc.extracted_text,
                "classification": doc.classification,
            },
            ensure_ascii=False,
        ),
        media_type="application/json",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, private", "Pragma": "no-cache"},
    )


@router.post("/shared/{token}/file")
async def shared_file(
    token: str,
    payload: SharePassword,
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
):
    link, doc = await _validated_share(token, payload.password.get_secret_value(), db)
    try:
        body = await get_storage().get(doc.file_path)
    except Exception as exc:
        raise HTTPException(503, "Document storage is unavailable") from exc
    db.add(
        AuditLog(
            actor_id=None,
            action="document.shared_downloaded",
            resource_type="document",
            resource_id=str(doc.id),
            detail={"share_id": str(link.id), "actor": "share-link guest"},
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
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": f'inline; filename="{doc.file_name}"',
        },
    )
