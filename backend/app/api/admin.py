import asyncio
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, SecretStr
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.background import BackgroundTask

from app.services.ocr_retry import request_ocr_retry
from app.api.deps import admin_user
from app.api.documents import run_ocr_batch_background
from app.core.config import settings
from app.core.security import _fernet, decode_access_token, decrypt_secret, encrypt_secret
from app.db import get_db
from app.models.audit_log import AuditLog
from app.models.document import Document
from app.models.system_api_key import SystemAPIKey
from app.models.user import User
from app.services import storage_service as _storage
from app.services.gemini_service import GeminiOCRService
from app.services.storage_service import get_storage

router = APIRouter()
MAX_BACKUP_BYTES = 2 * 1024 * 1024 * 1024
PRIMARY_GEMINI_PRIORITY = 1
PRIMARY_GEMINI_LABEL = "primary-gemini"


def require_step_up(x_admin_step_up: Annotated[str | None, Header()] = None):
    if not x_admin_step_up:
        raise HTTPException(401, "Master-password challenge required")
    try:
        token = decode_access_token(x_admin_step_up)
    except ValueError as exc:
        raise HTTPException(401, "Master-password challenge expired") from exc
    if token.get("sub") != "master-admin" or token.get("scope") != "admin:settings":
        raise HTTPException(403, "Invalid step-up authorization")
    return True


class StorageUpdate(BaseModel):
    provider: str = Field(pattern="^(local|s3)$")


class ReindexRequest(BaseModel):
    force: bool = False


class GeminiSettingsUpdate(BaseModel):
    api_key: SecretStr | None = None
    is_enabled: bool = True
    clear_key: bool = False


class GeminiTestPayload(BaseModel):
    api_key: SecretStr | None = None


def _mask_key(raw: str) -> str:
    cleaned = raw.strip()
    if len(cleaned) <= 8:
        return "•" * max(4, len(cleaned))
    return f"{cleaned[:4]}••••••{cleaned[-4:]}"


def _disk_stats() -> tuple[int | None, int | None]:
    root = Path(os.getenv("LOCAL_STORAGE_ROOT", "/data/archive"))
    try:
        disk = shutil.disk_usage(root if root.exists() else root.parent)
        return int(disk.total), int(disk.free)
    except OSError:
        return None, None


async def _get_primary_gemini_row(db: AsyncSession) -> SystemAPIKey | None:
    return await db.scalar(select(SystemAPIKey).where(SystemAPIKey.priority == PRIMARY_GEMINI_PRIORITY))


def _serialize_gemini_settings(row: SystemAPIKey | None) -> dict:
    has_db_key = bool(row and row.key_encrypted)
    is_enabled = bool(row.is_active) if row else False
    masked = None
    if row:
        meta_mask = (row.metadata_json or {}).get("masked_key")
        if isinstance(meta_mask, str) and meta_mask:
            masked = meta_mask
        else:
            masked = "••••••••"
    env_fallback = bool(settings.system_gemini_keys)
    return {
        "has_db_key": has_db_key,
        "masked_key": masked,
        "is_enabled": is_enabled,
        "env_fallback_configured": env_fallback,
        "effective_configured": (has_db_key and is_enabled) or env_fallback,
        "model": settings.gemini_model,
    }


@router.get("/gemini-settings")
async def get_gemini_settings(
    _: Annotated[User, Depends(admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    row = await _get_primary_gemini_row(db)
    return _serialize_gemini_settings(row)


@router.put("/gemini-settings")
async def update_gemini_settings(
    payload: GeminiSettingsUpdate,
    actor: Annotated[User, Depends(admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    row = await _get_primary_gemini_row(db)
    new_key = payload.api_key.get_secret_value().strip() if payload.api_key else ""
    key_updated = False

    if payload.clear_key:
        if row:
            await db.delete(row)
            row = None
        key_updated = True
    elif new_key:
        if len(new_key) < 12 or len(new_key) > 512:
            raise HTTPException(422, "صيغة مفتاح Gemini غير صالحة.")
        encrypted = encrypt_secret(new_key)
        meta = {"masked_key": _mask_key(new_key), "updated_at": datetime.now(timezone.utc).isoformat()}
        if row:
            row.key_encrypted = encrypted
            row.is_active = payload.is_enabled
            row.metadata_json = {**(row.metadata_json or {}), **meta}
        else:
            row = SystemAPIKey(
                label=PRIMARY_GEMINI_LABEL,
                key_encrypted=encrypted,
                priority=PRIMARY_GEMINI_PRIORITY,
                is_active=payload.is_enabled,
                metadata_json=meta,
            )
            db.add(row)
        key_updated = True
    elif row:
        row.is_active = payload.is_enabled
        row.metadata_json = {
            **(row.metadata_json or {}),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    else:
        raise HTTPException(422, "يرجى إدخال مفتاح Gemini لحفظه في قاعدة البيانات.")

    db.add(
        AuditLog(
            actor_id=actor.id,
            action="system.gemini_settings_updated",
            resource_type="system",
            resource_id=str(row.id) if row else None,
            detail={"is_enabled": payload.is_enabled, "key_updated": key_updated, "cleared": payload.clear_key},
        )
    )
    await db.commit()
    request_ocr_retry()
    if row:
        await db.refresh(row)
    return {
        "message": "تم حفظ إعدادات مفتاح Gemini.",
        **_serialize_gemini_settings(row),
    }


@router.post("/gemini-settings/test")
async def test_gemini_settings(
    payload: GeminiTestPayload,
    _: Annotated[User, Depends(admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    candidate = payload.api_key.get_secret_value().strip() if payload.api_key else ""
    source = "input"
    if not candidate:
        row = await _get_primary_gemini_row(db)
        if row and row.is_active and row.key_encrypted:
            try:
                candidate = decrypt_secret(row.key_encrypted).strip()
                source = "database"
            except ValueError:
                return {"ok": False, "source": "database", "message": "تعذر فك تشفير المفتاح المحفوظ."}
        elif settings.system_gemini_keys:
            candidate = settings.system_gemini_keys[0]
            source = "env"
        else:
            return {"ok": False, "source": "none", "message": "لا يوجد مفتاح مفعّل في قاعدة البيانات أو الإعدادات الاحتياطية."}

    ok, message = await GeminiOCRService().test_key(candidate)
    return {"ok": ok, "source": source, "message": message}


@router.get("/system-summary")
async def system_summary(_: Annotated[User, Depends(admin_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    total_docs = await db.scalar(select(func.count(Document.id)).where(Document.deleted_at.is_(None))) or 0
    indexed_docs = await db.scalar(
        select(func.count(Document.id)).where(
            Document.deleted_at.is_(None),
            Document.processing_status == "completed",
            Document.extracted_text.is_not(None),
            Document.extracted_text != "",
        )
    ) or 0
    pending_docs = total_docs - indexed_docs
    stored_bytes = await db.scalar(select(func.coalesce(func.sum(Document.file_size), 0))) or 0
    user_count = await db.scalar(select(func.count(User.id))) or 0
    disk_total, disk_free = _disk_stats()
    primary_key = await _get_primary_gemini_row(db)
    gemini_active = bool((primary_key and primary_key.is_active and primary_key.key_encrypted) or settings.system_gemini_keys)
    return {
        "provider": get_storage_provider(),
        "total_documents": int(total_docs),
        "indexed_documents": int(indexed_docs),
        "pending_documents": int(max(0, pending_docs)),
        "stored_file_bytes": int(stored_bytes),
        "disk_capacity_bytes": disk_total,
        "disk_free_bytes": disk_free,
        "user_count": int(user_count),
        "gemini_configured": gemini_active,
        "gemini_model": settings.gemini_model,
    }


@router.post("/reindex")
async def reindex_documents(
    payload: ReindexRequest,
    background_tasks: BackgroundTasks,
    actor: Annotated[User, Depends(admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    q = select(Document).where(Document.deleted_at.is_(None))
    if not payload.force:
        q = q.where(
            or_(
                Document.extracted_text.is_(None),
                Document.extracted_text == "",
                Document.processing_status != "completed",
            )
        )
    docs = (await db.scalars(q.order_by(Document.created_at.desc()))).all()
    total_docs = await db.scalar(select(func.count(Document.id)).where(Document.deleted_at.is_(None))) or 0

    user_keys_rows = (await db.execute(select(User.id, User.gemini_key_encrypted))).all()
    user_keys = {row.id: row.gemini_key_encrypted for row in user_keys_rows}

    jobs = []
    for doc in docs:
        doc.processing_status = "queued"
        doc.processing_error = None
        jobs.append((doc.id, doc.file_path, doc.mime_type, user_keys.get(doc.user_id)))

    db.add(
        AuditLog(
            actor_id=actor.id,
            action="system.ai_reindex_triggered",
            resource_type="system",
            resource_id=None,
            detail={"queued_count": len(jobs), "force": payload.force},
        )
    )
    await db.commit()

    if jobs:
        background_tasks.add_task(run_ocr_batch_background, jobs)

    return {
        "queued_count": len(jobs),
        "total_documents": int(total_docs),
        "force": payload.force,
        "message": f"تمت جدولة إعادة فهرسة {len(jobs)} مستند في الخلفية."
        if jobs
        else "جميع المستندات مفهرسة بالفعل ولا توجد ملفات بحاجة لإعادة فهرسة.",
    }


@router.get("/storage")
async def storage_settings(_: Annotated[User, Depends(admin_user)], __: Annotated[bool, Depends(require_step_up)]):
    return {
        "provider": get_storage_provider(),
        "bucket": settings.s3_bucket_name,
        "endpoint": settings.s3_endpoint_url,
        "credentials_exposed": False,
    }


@router.put("/storage")
async def update_storage(
    payload: StorageUpdate,
    _: Annotated[User, Depends(admin_user)],
    __: Annotated[bool, Depends(require_step_up)],
):
    set_storage_provider(payload.provider)
    return {"provider": payload.provider, "message": "Storage provider changed for this backend process"}


@router.post("/storage/test")
async def test_storage(_: Annotated[User, Depends(admin_user)], __: Annotated[bool, Depends(require_step_up)]):
    ok = await get_storage().ping()
    return {"ok": ok, "provider": get_storage_provider(), "message": "Connection successful" if ok else "Connection failed"}


@router.get("/storage/metrics")
async def storage_metrics(
    _: Annotated[User, Depends(admin_user)],
    __: Annotated[bool, Depends(require_step_up)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    count = await db.scalar(select(func.count(Document.id))) or 0
    stored = await db.scalar(select(func.coalesce(func.sum(Document.file_size), 0))) or 0
    total, free = _disk_stats()
    return {
        "provider": get_storage_provider(),
        "saved_files": count,
        "stored_file_bytes": int(stored),
        "disk_capacity_bytes": total,
        "disk_free_bytes": free,
        "connection_ok": await get_storage().ping(),
    }


@router.post("/backup/create")
async def create_backup(
    actor: Annotated[User, Depends(admin_user)],
    _: Annotated[bool, Depends(require_step_up)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    total = await db.scalar(select(func.coalesce(func.sum(Document.file_size), 0))) or 0
    count = await db.scalar(select(func.count(Document.id))) or 0
    if int(total) > MAX_BACKUP_BYTES:
        raise HTTPException(413, "Archive exceeds the 2 GiB interactive-backup limit")
    docs = (await db.execute(select(Document.id, Document.file_path, Document.file_name, Document.mime_type, Document.file_size))).all()
    tmpdir = tempfile.mkdtemp(prefix="archive-backup-")
    try:
        dump_path = os.path.join(tmpdir, "database.dump")
        env = os.environ.copy()
        env["PGPASSWORD"] = settings.postgres_password.get_secret_value()
        command = [
            "pg_dump",
            "--format=custom",
            "--no-owner",
            "--no-privileges",
            "--host",
            settings.postgres_host,
            "--port",
            str(settings.postgres_port),
            "--username",
            settings.postgres_user,
            settings.postgres_db,
            "--file",
            dump_path,
        ]
        proc = await asyncio.to_thread(subprocess.run, command, env=env, capture_output=True, timeout=300, check=False)
        if proc.returncode != 0:
            raise HTTPException(503, "Database backup failed; ensure pg_dump is installed and reachable")
        archive_path = os.path.join(tmpdir, "archive-yemany-backup.zip")
        fernet = _fernet()
        storage = get_storage()
        keys = await storage.list_keys()
        manifest = {
            "format": "Archive-Yemany encrypted backup",
            "version": 1,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "documents": [],
            "storage_objects": [],
            "database_member": "database.dump.fernet",
            "encryption": "Fernet using configured MASTER_ENCRYPTION_KEY",
        }
        if os.path.getsize(dump_path) > MAX_BACKUP_BYTES:
            raise HTTPException(413, "Database dump exceeds the 2 GiB interactive-backup limit")
        doc_by_key = {row.file_path: row for row in docs}
        backup_bytes = os.path.getsize(dump_path)
        with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=3) as zf:
            with open(dump_path, "rb") as src:
                zf.writestr("database.dump.fernet", fernet.encrypt(src.read()))
            for key in keys:
                plain = await storage.get(key)
                backup_bytes += len(plain)
                if backup_bytes > MAX_BACKUP_BYTES:
                    raise HTTPException(413, "Database and files exceed the 2 GiB interactive-backup limit")
                member = f"files/{hashlib.sha256(key.encode()).hexdigest()}.fernet"
                zf.writestr(member, fernet.encrypt(plain))
                record = {"storage_key": key, "member": member, "file_size": len(plain)}
                doc = doc_by_key.get(key)
                if doc:
                    record.update({"document_id": str(doc.id), "file_name": doc.file_name, "mime_type": doc.mime_type})
                    manifest["documents"].append(
                        {
                            "id": str(doc.id),
                            "storage_key": key,
                            "member": member,
                            "file_name": doc.file_name,
                            "mime_type": doc.mime_type,
                            "file_size": doc.file_size,
                        }
                    )
                manifest["storage_objects"].append(record)
            zf.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
        db.add(
            AuditLog(
                actor_id=actor.id,
                action="system.backup_created",
                resource_type="backup",
                resource_id=None,
                detail={"documents": count, "bytes": int(total)},
            )
        )
        await db.commit()
        return FileResponse(
            archive_path,
            media_type="application/zip",
            filename=f"archive-yemany-backup-{datetime.now(timezone.utc):%Y%m%d-%H%M%S}.zip",
            background=BackgroundTask(shutil.rmtree, tmpdir, True),
            headers={"Cache-Control": "no-store, no-cache, must-revalidate, private", "Pragma": "no-cache"},
        )
    except HTTPException:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise
    except Exception as exc:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(503, "Backup could not be created") from exc


@router.get("/storage/sync-status")
async def sync_status(_: Annotated[User, Depends(admin_user)], __: Annotated[bool, Depends(require_step_up)]):
    return {"status": "not_configured", "local_to_cloud": False, "detail": "No replication worker is configured"}


def get_storage_provider() -> str:
    return _storage.ACTIVE_PROVIDER


def set_storage_provider(provider: str) -> None:
    _storage.ACTIVE_PROVIDER = provider

# Managed key pool. Responses contain masked values only; never plaintext secrets.
class PoolKeyCreate(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    api_key: SecretStr = Field(min_length=20, max_length=256)
    daily_limit: int = Field(default=1500, ge=1, le=1000000)


class PoolKeyUpdate(BaseModel):
    is_active: bool | None = None
    daily_limit: int | None = Field(default=None, ge=1, le=1000000)
    label: str | None = Field(default=None, min_length=1, max_length=120)
    make_primary: bool = False


@router.get('/gemini-keys')
async def list_gemini_keys(actor: Annotated[User, Depends(admin_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    from app.services.gemini_usage import usage_snapshot
    result = []
    rows = (await db.scalars(select(SystemAPIKey).order_by(SystemAPIKey.priority))).all()
    for row in rows:
        try:
            value = decrypt_secret(row.key_encrypted)
            stats = await usage_snapshot(db, value)
        except ValueError:
            stats = {"status": "disabled", "reason": "unreadable_key", "requests_today": 0, "daily_limit": 1500, "remaining_estimate": 0}
            value = ''
        result.append({"id": str(row.id), "label": row.label, "kind": "system", "is_active": row.is_active,
                       "masked_key": _mask_key(value), "priority": row.priority, **stats,
                       "status": stats['status'] if row.is_active else 'disabled'})
    users = (await db.scalars(select(User).where(User.gemini_key_encrypted.is_not(None)))).all()
    for user in users:
        try:
            value = decrypt_secret(user.gemini_key_encrypted)
        except ValueError:
            result.append({"id": str(user.id), "label": user.full_name or user.username, "kind": "user",
                           "is_active": user.is_active, "masked_key": "••••••••", "status": "disabled", "reason": "unreadable_key",
                           "requests_today": 0, "daily_limit": 1500, "remaining_estimate": 0})
            continue
        stats = await usage_snapshot(db, value)
        result.append({"id": str(user.id), "label": user.full_name or user.username, "kind": "user",
                       "is_active": user.is_active, "masked_key": _mask_key(value), **stats,
                       "status": stats['status'] if user.is_active else 'disabled'})
    from app.services.gemini_usage import fingerprint
    managed = set()
    for row in rows:
        try:
            managed.add(fingerprint(decrypt_secret(row.key_encrypted)))
        except ValueError:
            pass
    for index, value in enumerate(settings.system_gemini_keys, 1):
        if fingerprint(value) in managed:
            continue
        stats = await usage_snapshot(db, value)
        result.append({"id": fingerprint(value), "label": f"Environment fallback {index}", "kind": "environment", "is_active": True,
                       "masked_key": _mask_key(value), **stats})
    return result


@router.post('/gemini-keys', status_code=201)
async def create_gemini_key(payload: PoolKeyCreate, actor: Annotated[User, Depends(admin_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    from app.services.gemini_usage import locked_usage, fingerprint
    # Transaction advisory lock serializes priority allocation, including across workers.
    from sqlalchemy import text
    await db.execute(text("SELECT pg_advisory_xact_lock(726194)"))
    value = payload.api_key.get_secret_value().strip()
    if not payload.label.strip() or len(value) < 20:
        raise HTTPException(422, 'Invalid key label or key format')
    for existing in (await db.scalars(select(SystemAPIKey))).all():
        try:
            duplicate = fingerprint(decrypt_secret(existing.key_encrypted)) == fingerprint(value)
        except ValueError:
            continue
        if duplicate:
            raise HTTPException(409, "API key already exists")
    priority = int(await db.scalar(select(func.max(SystemAPIKey.priority))) or 0) + 1
    row = SystemAPIKey(label=payload.label.strip(), key_encrypted=encrypt_secret(value), priority=priority, is_active=True)
    db.add(row)
    await db.flush()
    usage = await locked_usage(db, value)
    usage.daily_limit = payload.daily_limit
    db.add(AuditLog(actor_id=actor.id, action='gemini_key.created', resource_type='system_api_key', resource_id=str(row.id), detail={"label": row.label, "daily_limit": payload.daily_limit}))
    await db.commit()
    request_ocr_retry()
    return {"id": str(row.id)}


@router.patch('/gemini-keys/{key_id}')
async def update_gemini_key(key_id: str, payload: PoolKeyUpdate, actor: Annotated[User, Depends(admin_user)], db: Annotated[AsyncSession, Depends(get_db)], kind: str = 'system'):
    import uuid
    from app.services.gemini_usage import locked_usage
    if payload.make_primary and kind != 'system':
        raise HTTPException(422, 'Only system keys can be reordered')
    if kind == 'environment':
        from app.services.gemini_usage import fingerprint
        value = next((key for key in settings.system_gemini_keys if fingerprint(key) == key_id), None)
        if not value:
            raise HTTPException(404, 'Key not found')
        if payload.is_active is not None or payload.label is not None:
            raise HTTPException(422, 'Environment keys are managed through deployment configuration')
        usage = await locked_usage(db, value)
        if payload.daily_limit is not None:
            usage.daily_limit = payload.daily_limit
        db.add(AuditLog(actor_id=actor.id, action='gemini_key.updated', resource_type='environment_api_key', detail={"daily_limit": payload.daily_limit}))
        await db.commit()
        request_ocr_retry()
        return {"ok": True}
    if kind not in {'system', 'user'}:
        raise HTTPException(422, 'Invalid key kind')
    try:
        uid = uuid.UUID(key_id)
    except ValueError:
        raise HTTPException(422, 'Invalid key id')
    row = await db.get(SystemAPIKey if kind == 'system' else User, uid)
    if not row:
        raise HTTPException(404, 'Key not found')
    encrypted = row.key_encrypted if kind == 'system' else row.gemini_key_encrypted
    if not encrypted:
        raise HTTPException(404, 'Key not found')
    usage = await locked_usage(db, decrypt_secret(encrypted))
    if payload.label is not None and not payload.label.strip():
        raise HTTPException(422, 'Key label is required')
    if payload.daily_limit is not None:
        usage.daily_limit = payload.daily_limit
    if kind == 'system':
        if payload.make_primary:
            from sqlalchemy import text
            await db.execute(text('SELECT pg_advisory_xact_lock(726194)'))
            row.priority = int(await db.scalar(select(func.min(SystemAPIKey.priority))) or 0) - 1
        if payload.is_active is not None:
            row.is_active = payload.is_active
            if payload.is_active:
                usage.provider_disabled = False
        if payload.label is not None:
            row.label = payload.label.strip()
    elif payload.is_active is not None:
        raise HTTPException(422, 'Personal key is managed in user settings')
    db.add(AuditLog(actor_id=actor.id, action='gemini_key.updated', resource_type=kind + '_api_key', resource_id=key_id, detail=payload.model_dump(exclude_none=True)))
    await db.commit()
    request_ocr_retry()
    return {"ok": True}


@router.delete('/gemini-keys/{key_id}')
async def delete_gemini_key(key_id: str, actor: Annotated[User, Depends(admin_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    import uuid
    try:
        uid = uuid.UUID(key_id)
    except ValueError:
        raise HTTPException(422, 'Invalid key id')
    row = await db.get(SystemAPIKey, uid)
    if not row:
        raise HTTPException(404, 'Key not found')
    db.add(AuditLog(actor_id=actor.id, action='gemini_key.deleted', resource_type='system_api_key', resource_id=key_id, detail={"label": row.label}))
    await db.delete(row)
    await db.commit()
    return {"ok": True}


@router.get('/gemini-status')
async def gemini_status(_: Annotated[User, Depends(admin_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    from app.services.indexing_status import indexing_reason
    counts = {'queued': 0, 'processing': 0, 'failed': 0}
    reasons = {}
    rows = (await db.execute(select(Document.processing_status, Document.processing_error, func.count(Document.id))
        .where(Document.deleted_at.is_(None), Document.processing_status.in_(counts))
        .group_by(Document.processing_status, Document.processing_error))).all()
    for status, error, count in rows:
        counts[status] += count
        reason = indexing_reason(status, error)
        if reason: reasons[reason] = reasons.get(reason, 0) + count
    return {'model': settings.gemini_model, **counts, 'reasons': reasons}


@router.post('/gemini-keys/{key_id}/test')
async def test_pool_key(key_id: str, actor: Annotated[User, Depends(admin_user)], db: Annotated[AsyncSession, Depends(get_db)], kind: str = 'system'):
    import uuid
    from app.services.gemini_usage import fingerprint
    if kind == 'environment':
        value = next((key for key in settings.system_gemini_keys if fingerprint(key) == key_id), None)
        if not value: raise HTTPException(404, 'Key not found')
    elif kind in {'system', 'user'}:
        try: uid = uuid.UUID(key_id)
        except ValueError: raise HTTPException(422, 'Invalid key id')
        row = await db.get(SystemAPIKey if kind == 'system' else User, uid)
        encrypted = (row.key_encrypted if kind == 'system' else row.gemini_key_encrypted) if row else None
        if not encrypted: raise HTTPException(404, 'Key not found')
        try: value = decrypt_secret(encrypted)
        except ValueError: return {'ok': False, 'code': 'unreadable_key', 'model': settings.gemini_model}
    else:
        raise HTTPException(422, 'Invalid key kind')
    result = await GeminiOCRService().check_key(value)
    db.add(AuditLog(actor_id=actor.id, action='gemini_key.tested', resource_type=kind + '_api_key',
                    detail={'result': result['code']}))
    await db.commit()
    if result['ok']: request_ocr_retry()
    return result
