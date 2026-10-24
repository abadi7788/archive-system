from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.db import get_db
from app.models.document import Document
from app.models.user import User, UserRole

router = APIRouter()


@router.get("")
async def search_documents(q: Annotated[str, Query(min_length=2, max_length=200)], user: Annotated[User, Depends(current_user)], db: Annotated[AsyncSession, Depends(get_db)], limit: Annotated[int, Query(ge=1, le=100)] = 30):
    # Websearch syntax supports ordinary phrases and multiword queries without exposing raw SQL.
    tsquery = func.websearch_to_tsquery("simple", q)
    match = Document.search_vector.op("@@")(tsquery)
    query = select(Document).where(match)
    if user.role != UserRole.ADMIN:
        query = query.where(Document.user_id == user.id)
    query = query.order_by(func.ts_rank(Document.search_vector, tsquery).desc(), Document.created_at.desc()).limit(limit)
    rows = (await db.scalars(query)).all()
    return [{"id": str(d.id), "file_name": d.file_name, "summary": d.summary, "snippet": (d.extracted_text or "")[:500], "status": d.processing_status, "created_at": d.created_at} for d in rows]
