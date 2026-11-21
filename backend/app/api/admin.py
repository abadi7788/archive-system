import asyncio
import json
import hashlib
import os
import shutil
import subprocess
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.background import BackgroundTask

from app.api.deps import admin_user
from app.core.config import settings
from app.core.security import _fernet, decode_access_token
from app.db import get_db
from app.models.audit_log import AuditLog
from app.models.document import Document
from app.models.user import User
from app.services.storage_service import get_storage

router = APIRouter()
MAX_BACKUP_BYTES=2*1024*1024*1024


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


@router.get("/storage")
async def storage_settings(_: Annotated[User, Depends(admin_user)], __: Annotated[bool, Depends(require_step_up)]):
    return {"provider": get_storage_provider(), "bucket": settings.s3_bucket_name, "endpoint": settings.s3_endpoint_url, "credentials_exposed": False}


@router.put("/storage")
async def update_storage(payload: StorageUpdate, _: Annotated[User, Depends(admin_user)], __: Annotated[bool, Depends(require_step_up)]):
    set_storage_provider(payload.provider)
    return {"provider": payload.provider, "message": "Storage provider changed for this backend process"}


@router.post("/storage/test")
async def test_storage(_: Annotated[User, Depends(admin_user)], __: Annotated[bool, Depends(require_step_up)]):
    ok = await get_storage().ping()
    return {"ok": ok, "provider": get_storage_provider(), "message": "Connection successful" if ok else "Connection failed"}


@router.get("/storage/metrics")
async def storage_metrics(_: Annotated[User, Depends(admin_user)], __: Annotated[bool, Depends(require_step_up)], db: Annotated[AsyncSession, Depends(get_db)]):
    count=await db.scalar(select(func.count(Document.id))) or 0
    stored=await db.scalar(select(func.coalesce(func.sum(Document.file_size),0))) or 0
    root=Path(os.getenv('LOCAL_STORAGE_ROOT','/data/archive'))
    try:
        disk=shutil.disk_usage(root if root.exists() else root.parent)
        total=int(disk.total); free=int(disk.free)
    except OSError:
        total=free=None
    return {"provider":get_storage_provider(),"saved_files":count,"stored_file_bytes":int(stored),"disk_capacity_bytes":total,"disk_free_bytes":free,"connection_ok":await get_storage().ping()}


@router.post('/backup/create')
async def create_backup(actor:Annotated[User,Depends(admin_user)],_:Annotated[bool,Depends(require_step_up)],db:Annotated[AsyncSession,Depends(get_db)]):
    total=await db.scalar(select(func.coalesce(func.sum(Document.file_size),0))) or 0
    count=await db.scalar(select(func.count(Document.id))) or 0
    if int(total)>MAX_BACKUP_BYTES:raise HTTPException(413,'Archive exceeds the 2 GiB interactive-backup limit')
    docs=(await db.execute(select(Document.id,Document.file_path,Document.file_name,Document.mime_type,Document.file_size))).all()
    tmpdir=tempfile.mkdtemp(prefix='archive-backup-')
    try:
        dump_path=os.path.join(tmpdir,'database.dump')
        env=os.environ.copy();env['PGPASSWORD']=settings.postgres_password.get_secret_value()
        command=['pg_dump','--format=custom','--no-owner','--no-privileges','--host',settings.postgres_host,'--port',str(settings.postgres_port),'--username',settings.postgres_user,settings.postgres_db,'--file',dump_path]
        proc=await asyncio.to_thread(subprocess.run,command,env=env,capture_output=True,timeout=300,check=False)
        if proc.returncode!=0:raise HTTPException(503,'Database backup failed; ensure pg_dump is installed and reachable')
        archive_path=os.path.join(tmpdir,'archive-yemany-backup.zip')
        fernet=_fernet();storage=get_storage();keys=await storage.list_keys()
        manifest={'format':'Archive-Yemany encrypted backup','version':1,'created_at':datetime.now(timezone.utc).isoformat(),'documents':[],'storage_objects':[],'database_member':'database.dump.fernet','encryption':'Fernet using configured MASTER_ENCRYPTION_KEY'}
        if os.path.getsize(dump_path)>MAX_BACKUP_BYTES:raise HTTPException(413,'Database dump exceeds the 2 GiB interactive-backup limit')
        doc_by_key={row.file_path:row for row in docs};backup_bytes=os.path.getsize(dump_path)
        with zipfile.ZipFile(archive_path,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=3) as zf:
            with open(dump_path,'rb') as src:zf.writestr('database.dump.fernet',fernet.encrypt(src.read()))
            for index,key in enumerate(keys):
                plain=await storage.get(key);backup_bytes+=len(plain)
                if backup_bytes>MAX_BACKUP_BYTES:raise HTTPException(413,'Database and files exceed the 2 GiB interactive-backup limit')
                member=f"files/{hashlib.sha256(key.encode()).hexdigest()}.fernet"
                zf.writestr(member,fernet.encrypt(plain))
                record={'storage_key':key,'member':member,'file_size':len(plain)}
                doc=doc_by_key.get(key)
                if doc:
                    record.update({'document_id':str(doc.id),'file_name':doc.file_name,'mime_type':doc.mime_type})
                    manifest['documents'].append({'id':str(doc.id),'storage_key':key,'member':member,'file_name':doc.file_name,'mime_type':doc.mime_type,'file_size':doc.file_size})
                manifest['storage_objects'].append(record)
            zf.writestr('manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2))
        db.add(AuditLog(actor_id=actor.id,action='system.backup_created',resource_type='backup',resource_id=None,detail={'documents':count,'bytes':int(total)}))
        await db.commit()
        return FileResponse(archive_path,media_type='application/zip',filename=f'archive-yemany-backup-{datetime.now(timezone.utc):%Y%m%d-%H%M%S}.zip',background=BackgroundTask(shutil.rmtree,tmpdir,True),headers={'Cache-Control':'no-store, no-cache, must-revalidate, private','Pragma':'no-cache'})
    except HTTPException:
        shutil.rmtree(tmpdir,ignore_errors=True);raise
    except Exception as exc:
        shutil.rmtree(tmpdir,ignore_errors=True)
        raise HTTPException(503,'Backup could not be created') from exc


@router.get("/storage/sync-status")
async def sync_status(_: Annotated[User, Depends(admin_user)], __: Annotated[bool, Depends(require_step_up)]):
    return {"status": "not_configured", "local_to_cloud": False, "detail": "No replication worker is configured"}


from app.services import storage_service as _storage

def get_storage_provider() -> str:
    return _storage.ACTIVE_PROVIDER

def set_storage_provider(provider: str) -> None:
    _storage.ACTIVE_PROVIDER = provider
