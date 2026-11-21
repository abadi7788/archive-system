from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import admin_user
from app.db import get_db
from app.models.audit_log import AuditLog
from app.models.user import User

router = APIRouter()

@router.get("")
async def recent_audit_logs(_: Annotated[User, Depends(admin_user)], db: Annotated[AsyncSession, Depends(get_db)], limit: int = 100):
    if not 1 <= limit <= 500:
        raise HTTPException(422, "Limit must be between 1 and 500")
    rows = (await db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit))).all()
    return [{"id":str(x.id),"actor_id":str(x.actor_id) if x.actor_id else None,"action":x.action,"resource_type":x.resource_type,"resource_id":x.resource_id,"detail":x.detail,"created_at":x.created_at} for x in rows]
