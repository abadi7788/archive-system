from datetime import date, datetime, time, timedelta, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import admin_user
from app.db import get_db
from app.models.audit_log import AuditLog
from app.models.user import User

router = APIRouter()


@router.get('')
async def recent_audit_logs(
    _: Annotated[User, Depends(admin_user)], db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=100, ge=1, le=500), offset: int = Query(default=0, ge=0),
    employee: str = Query(default='', max_length=160), action: str = Query(default='', max_length=80),
    from_date: date | None = None, to_date: date | None = None,
):
    if from_date and to_date and from_date > to_date:
        raise HTTPException(422, 'Invalid date range')
    query = select(AuditLog, User).outerjoin(User, User.id == AuditLog.actor_id)
    if employee.strip():
        term = '%' + employee.strip().replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
        query = query.where(or_(User.username.ilike(term, escape='\\'), User.full_name.ilike(term, escape='\\'),
                               AuditLog.detail['actor_name'].astext.ilike(term, escape='\\'),
                               AuditLog.detail['username'].astext.ilike(term, escape='\\')))
    if action.strip():
        query = query.where(AuditLog.action.contains(action.strip(), autoescape=True))
    if from_date:
        query = query.where(AuditLog.created_at >= datetime.combine(from_date, time.min, timezone.utc))
    if to_date:
        query = query.where(AuditLog.created_at < datetime.combine(to_date, time.min, timezone.utc) + timedelta(days=1))
    rows = (await db.execute(query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).offset(offset).limit(limit))).all()
    return [{"id": str(event.id), "actor_id": str(event.actor_id) if event.actor_id else None,
             "actor_name": event.detail.get('actor_name') or ((actor.full_name or actor.username) if actor else event.detail.get('username', '—')),
             "action": event.action, "resource_type": event.resource_type, "resource_id": event.resource_id,
             "detail": event.detail, "ip_address": str(event.ip_address) if event.ip_address else None,
             "created_at": event.created_at} for event, actor in rows]
