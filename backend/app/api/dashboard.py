from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.access import build_document_visibility_clause
from app.api.deps import current_user
from app.db import get_db
from app.models.document import Document
from app.models.user import User, UserRole
from app.models.audit_log import AuditLog

router = APIRouter()


@router.get("/stats")
async def stats(user: Annotated[User, Depends(current_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    vis = await build_document_visibility_clause(user, db)
    vis = vis & (Document.user_id == user.id)
    count = await db.scalar(select(func.count(Document.id)).where(vis)) or 0
    size = await db.scalar(select(func.coalesce(func.sum(Document.file_size), 0)).where(vis)) or 0
    processed = await db.scalar(select(func.count(Document.id)).where(vis, Document.processing_status == "completed")) or 0
    activities = []
    if user.role == UserRole.ADMIN:
        rows = (await db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(6))).all()
        activities = [{"action": x.action, "resource_type": x.resource_type, "created_at": x.created_at} for x in rows]
    return {"document_count": count, "storage_bytes": size, "processed_count": processed, "recent_activity": activities}
