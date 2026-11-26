import uuid
from typing import Annotated, Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import admin_user, current_user
from app.api.access import build_user_display_map, linked_permissions
from app.db import get_db
from app.models.user import User, UserRole
from app.models.employee_relationship import EmployeeRelationship as Relationship
from app.models.audit_log import AuditLog

router = APIRouter()


class RelationshipPayload(BaseModel):
    user_a_id: uuid.UUID
    user_b_id: uuid.UUID
    mode: Literal['mutual', 'supervisory'] = 'mutual'
    access: Literal['read', 'full'] = 'read'


def details(row):
    return {key: str(getattr(row, key)) for key in ('user_a_id', 'user_b_id', 'mode', 'access')}


async def serialize(db):
    rows = (await db.scalars(select(Relationship).order_by(Relationship.created_at.desc()))).all()
    users = await build_user_display_map(db, {uid for r in rows for uid in (r.user_a_id, r.user_b_id)})
    return [{'id': str(r.id), **details(r), 'user_a': users.get(r.user_a_id), 'user_b': users.get(r.user_b_id),
             'created_at': r.created_at} for r in rows]


@router.get('/team')
async def team(user: Annotated[User, Depends(current_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    permissions = await linked_permissions(user, db)
    users = await build_user_display_map(db, set(permissions))
    active = set((await db.scalars(select(User.id).where(User.id.in_(permissions), User.is_active.is_(True)))).all())
    # Never return relationship IDs, reverse links, or supervisors to a supervised employee.
    return [{**users[uid], 'access': 'read' if user.role == UserRole.VIEWER else permissions[uid]}
            for uid in sorted(active, key=lambda uid: users[uid]['display_name'].lower())]


@router.get('')
async def listing(_: Annotated[User, Depends(admin_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    return await serialize(db)


async def save(payload, actor, db, relationship_id=None):
    if payload.user_a_id == payload.user_b_id: raise HTTPException(422, 'Select two different employees')
    ids = {payload.user_a_id, payload.user_b_id}
    if len((await db.scalars(select(User.id).where(User.id.in_(ids), User.is_active.is_(True)))).all()) != 2:
        raise HTTPException(422, 'Select two active employees')
    pair_key = ':'.join(sorted(str(uid) for uid in ids))
    # Serialize duplicate-pair requests; no limit on the number of distinct peers.
    await db.execute(text('SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))'), {'key': 'relationship:' + pair_key})
    existing = await db.scalar(select(Relationship).where(Relationship.pair_key == pair_key))
    if existing and existing.id != relationship_id: raise HTTPException(409, 'These employees already have a relationship')
    row = await db.scalar(select(Relationship).where(Relationship.id == relationship_id).with_for_update()) if relationship_id else Relationship(created_by=actor.id)
    if not row: raise HTTPException(404, 'Relationship not found')
    old = details(row) if relationship_id else None
    # Editing changes direction/permission, not the participants; revoke and recreate for a new pair.
    if relationship_id and row.pair_key != pair_key: raise HTTPException(422, 'Revoke the existing relationship before changing employees')
    row.user_a_id, row.user_b_id = payload.user_a_id, payload.user_b_id
    row.pair_key, row.mode, row.access = pair_key, payload.mode, payload.access
    db.add(row)
    await db.flush()
    db.add(AuditLog(actor_id=actor.id, action='employee_relationship.updated' if old else 'employee_relationship.created',
        resource_type='employee_relationship', resource_id=str(row.id), detail={'before': old, 'after': details(row)}))
    await db.commit()
    return next(item for item in await serialize(db) if item['id'] == str(row.id))


@router.post('', status_code=201)
async def create(payload: RelationshipPayload, actor: Annotated[User, Depends(admin_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    return await save(payload, actor, db)


@router.put('/{relationship_id}')
async def update(relationship_id: uuid.UUID, payload: RelationshipPayload, actor: Annotated[User, Depends(admin_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    return await save(payload, actor, db, relationship_id)


@router.delete('/{relationship_id}', status_code=204)
async def revoke(relationship_id: uuid.UUID, actor: Annotated[User, Depends(admin_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    row = await db.scalar(select(Relationship).where(Relationship.id == relationship_id).with_for_update())
    if not row: raise HTTPException(404, 'Relationship not found')
    db.add(AuditLog(actor_id=actor.id, action='employee_relationship.deleted', resource_type='employee_relationship',
                   resource_id=str(row.id), detail={'before': details(row)}))
    await db.delete(row)
    await db.commit()
