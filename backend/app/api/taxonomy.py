import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import admin_user, current_user
from app.db import get_db
from app.models.audit_log import AuditLog
from app.models.taxonomy import TaxonomyItem
from app.models.user import User

router = APIRouter()

VALID_KINDS = {"department", "classification"}


class TaxonomyCreatePayload(BaseModel):
    kind: str = Field(min_length=3, max_length=32)
    name: str = Field(min_length=1, max_length=160)


@router.get("")
async def list_taxonomy(
    _: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return standardized admin-managed departments and classifications for all authenticated users."""
    rows = (await db.scalars(select(TaxonomyItem).order_by(TaxonomyItem.name))).all()
    departments = [{"id": str(r.id), "name": r.name} for r in rows if r.kind == "department"]
    classifications = [{"id": str(r.id), "name": r.name} for r in rows if r.kind == "classification"]
    return {"departments": departments, "classifications": classifications}


@router.post("", status_code=201)
async def create_taxonomy_item(
    payload: TaxonomyCreatePayload,
    actor: Annotated[User, Depends(admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    kind = payload.kind.strip().lower()
    if kind not in VALID_KINDS:
        raise HTTPException(422, "kind must be 'department' or 'classification'")
    name = payload.name.strip()
    if not name:
        raise HTTPException(422, "Name cannot be empty")

    exists = await db.scalar(
        select(TaxonomyItem.id).where(
            TaxonomyItem.kind == kind,
            func.lower(TaxonomyItem.name) == name.lower(),
        )
    )
    if exists:
        raise HTTPException(409, "Item already exists")

    item = TaxonomyItem(kind=kind, name=name, created_by=actor.id)
    db.add(item)
    await db.flush()
    db.add(
        AuditLog(
            actor_id=actor.id,
            action="taxonomy.created",
            resource_type="taxonomy",
            resource_id=str(item.id),
            detail={"kind": kind, "name": name},
        )
    )
    await db.commit()
    return {"id": str(item.id), "kind": item.kind, "name": item.name}


@router.delete("/{item_id}", status_code=204)
async def delete_taxonomy_item(
    item_id: uuid.UUID,
    actor: Annotated[User, Depends(admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    item = await db.get(TaxonomyItem, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    kind, name = item.kind, item.name
    await db.delete(item)
    db.add(
        AuditLog(
            actor_id=actor.id,
            action="taxonomy.deleted",
            resource_type="taxonomy",
            resource_id=str(item_id),
            detail={"kind": kind, "name": name},
        )
    )
    await db.commit()
    return Response(status_code=204)
