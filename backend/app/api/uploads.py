"""Resumable ordered uploads. Total size is not capped; each request is bounded to 4 MiB."""
import asyncio
import hashlib
import os
import shutil
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import current_user
from app.api.documents import _can_write_folder, store_uploaded_document
from app.core.config import settings
from app.db import get_db
from app.models.document import Document
from app.models.folder import Folder
from app.models.upload_session import UploadSession
from app.models.user import User, UserRole
from app.services.encrypted_stream import MAGIC, decrypted_records, record
from app.services.file_types import EXTENSIONS
from app.services.names import validate_name
from app.services.storage_service import LOCAL_ROOT

router = APIRouter()
CHUNK_BYTES = 4 * 1024 * 1024
# Must be shared by backend replicas that share the same database.
UPLOAD_ROOT = Path(os.getenv('UPLOAD_TEMP_ROOT', str(LOCAL_ROOT / '.uploads')))


class UploadInit(BaseModel):
    file_name: str = Field(min_length=1, max_length=250)
    file_size: int = Field(gt=0, le=9223372036854775807)
    folder_id: uuid.UUID | None = None
    department: str | None = Field(default=None, max_length=160)
    classification: str | None = Field(default=None, max_length=120)
    keywords: str | None = Field(default=None, max_length=4000)
    summary: str | None = Field(default=None, max_length=10000)


def path_for(upload_id): return UPLOAD_ROOT / f'{upload_id}.part'

def result(upload):
    return {'id': str(upload.id), 'received': upload.received, 'file_size': upload.file_size,
            'chunk_size': CHUNK_BYTES, 'expires_at': upload.expires_at, 'completed': bool(upload.document_id)}


async def owned_session(db, upload_id, user, lock=False):
    if user.role == UserRole.VIEWER: raise HTTPException(403, 'Write access required')
    query = select(UploadSession).where(UploadSession.id == upload_id, UploadSession.user_id == user.id)
    if lock: query = query.with_for_update()
    upload = await db.scalar(query)
    if not upload: raise HTTPException(404, 'Upload session not found')
    if upload.expires_at < datetime.now(timezone.utc): raise HTTPException(410, 'Upload session expired; select the file again')
    if not upload.document_id and not await asyncio.to_thread(path_for(upload.id).is_file):
        raise HTTPException(410, 'Upload session expired; select the file again')
    return upload


async def cleanup_uploads(db):
    expired = (await db.scalars(select(UploadSession).where(UploadSession.expires_at < datetime.now(timezone.utc)).limit(100).with_for_update(skip_locked=True))).all()
    for upload in expired:
        await asyncio.to_thread(path_for(upload.id).unlink, missing_ok=True)
        await db.delete(upload)
    await db.commit()


@router.post('', status_code=201)
async def initiate(payload: UploadInit, user: Annotated[User, Depends(current_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    if user.role == UserRole.VIEWER: raise HTTPException(403, 'Write access required')
    name = validate_name(payload.file_name, 250)
    if Path(name).suffix.lower() not in EXTENSIONS: raise HTTPException(415, 'Unsupported file type')
    if payload.folder_id:
        folder = await db.get(Folder, payload.folder_id)
        if not folder or folder.deleted_at is not None: raise HTTPException(404, 'Folder not found')
        if not await _can_write_folder(folder, user, db): raise HTTPException(403, 'Write access to this folder is required')
    await cleanup_uploads(db)
    upload = UploadSession(id=uuid.uuid4(), user_id=user.id, file_name=name, file_size=payload.file_size,
        received=0, stored_bytes=len(MAGIC) + 16, chunks=0,
        options=payload.model_dump(mode='json', exclude={'file_name', 'file_size'}),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.upload_session_hours))
    def create():
        UPLOAD_ROOT.mkdir(parents=True, exist_ok=True, mode=0o700)
        fd = os.open(path_for(upload.id), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, 'wb') as target: target.write(MAGIC + upload.id.bytes)
    try: await asyncio.to_thread(create)
    except OSError as exc: raise HTTPException(507, 'Upload staging storage is unavailable') from exc
    db.add(upload)
    try: await db.commit()
    except Exception:
        await asyncio.to_thread(path_for(upload.id).unlink, missing_ok=True)
        raise
    return result(upload)


@router.get('/{upload_id}')
async def status(upload_id: uuid.UUID, user: Annotated[User, Depends(current_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    return result(await owned_session(db, upload_id, user))


@router.put('/{upload_id}')
async def append(upload_id: uuid.UUID, offset: int, request: Request, user: Annotated[User, Depends(current_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    upload = await owned_session(db, upload_id, user, lock=True)
    if upload.document_id: raise HTTPException(409, 'Upload already completed')
    chunk = bytearray()
    async for data in request.stream():
        if len(chunk) + len(data) > CHUNK_BYTES: raise HTTPException(413, 'Upload chunk is too large')
        chunk.extend(data)
    if not chunk: raise HTTPException(422, 'Empty upload chunk')
    digest = hashlib.sha256(chunk).hexdigest()
    if offset == upload.last_offset and digest == upload.last_digest:
        return result(upload)  # Lost response: the exact last chunk is idempotent.
    if offset != upload.received: raise HTTPException(409, 'Upload offset mismatch; query session status')
    if upload.received + len(chunk) > upload.file_size: raise HTTPException(422, 'Chunk exceeds declared file size')
    encoded = await asyncio.to_thread(record, bytes(chunk), upload.chunks, upload.id.bytes)
    def write():
        with path_for(upload.id).open('r+b') as target:
            if target.seek(0, 2) < upload.stored_bytes: raise OSError('Missing upload data')
            target.truncate(upload.stored_bytes)  # Recover disk writes left by a rolled-back DB transaction.
            target.seek(upload.stored_bytes)
            target.write(encoded)
            target.flush()
            os.fsync(target.fileno())
    try: await asyncio.to_thread(write)
    except OSError as exc: raise HTTPException(507, 'Upload staging storage is unavailable') from exc
    upload.last_offset, upload.last_digest = offset, digest
    upload.received += len(chunk)
    upload.stored_bytes += len(encoded)
    upload.chunks += 1
    upload.expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.upload_session_hours)
    await db.commit()
    return result(upload)


@router.post('/{upload_id}/complete')
async def complete(upload_id: uuid.UUID, background_tasks: BackgroundTasks, request: Request,
                   user: Annotated[User, Depends(current_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    upload = await owned_session(db, upload_id, user, lock=True)
    if upload.document_id:
        doc = await db.get(Document, upload.document_id)
        if not doc or doc.deleted_at is not None: raise HTTPException(410, 'Completed document is no longer available')
        return {'id': str(doc.id), 'file_name': doc.file_name, 'mime_type': doc.mime_type, 'file_size': doc.file_size,
                'folder_id': str(doc.folder_id) if doc.folder_id else None, 'status': doc.processing_status, 'can_manage': True}
    if upload.received != upload.file_size: raise HTTPException(409, 'Upload is incomplete')
    def decrypt():
        target = tempfile.TemporaryFile()
        try:
            with path_for(upload.id).open('rb') as source:
                for data in decrypted_records(source, require_final=False): target.write(data)
            if target.tell() != upload.file_size: raise ValueError('Upload size mismatch')
            target.seek(0)
            return target
        except Exception:
            target.close()
            raise
    try: source = await asyncio.to_thread(decrypt)
    except (OSError, ValueError) as exc: raise HTTPException(503, 'Upload data unavailable; restart upload') from exc
    try:
        # Same transaction commits the document and completion marker for safe retries.
        response = await store_uploaded_document(background_tasks, source, upload.file_name, upload.file_size,
            user, db, request, document_id=upload.id, completion=upload, **upload.options)
    finally: source.close()
    await asyncio.to_thread(path_for(upload.id).unlink, missing_ok=True)
    return response


@router.delete('/{upload_id}', status_code=204)
async def cancel(upload_id: uuid.UUID, user: Annotated[User, Depends(current_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    upload = await owned_session(db, upload_id, user, lock=True)
    await asyncio.to_thread(path_for(upload.id).unlink, missing_ok=True)
    await db.delete(upload)
    await db.commit()
