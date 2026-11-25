import re
from datetime import date, datetime, time, timedelta, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import (
    build_document_visibility_clause,
    build_user_display_map,
    get_visible_owner_ids,
)
from app.api.deps import current_user
from app.api.documents import build_folder_breadcrumbs, format_document_path
from app.db import get_db
from app.models.document import Document
from app.models.user import User, UserRole

router = APIRouter()


def _build_highlighted_snippet(text: str | None, query_str: str, ts_headline_value: str | None) -> str:
    if ts_headline_value and "⟦" in ts_headline_value:
        return ts_headline_value
    source = (text or "").strip()
    if not source:
        return ""
    tokens = [tok for tok in re.split(r"\s+", query_str.strip()) if tok]
    if not tokens:
        return source[:320]
    lower_source = source.lower()
    best_idx = -1
    for tok in tokens:
        idx = lower_source.find(tok.lower())
        if idx != -1 and (best_idx == -1 or idx < best_idx):
            best_idx = idx
    if best_idx == -1:
        return source[:320]
    start = max(0, best_idx - 110)
    end = min(len(source), best_idx + 210)
    window = source[start:end]
    pattern = re.compile("|".join(re.escape(tok) for tok in sorted(tokens, key=len, reverse=True)), re.IGNORECASE)
    highlighted = pattern.sub(lambda m: f"⟦{m.group(0)}⟧", window)
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(source) else ""
    return f"{prefix}{highlighted}{suffix}"


@router.get("")
async def search_documents(
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    q: Annotated[str | None, Query(max_length=200)] = None,
    department: str | None = None,
    mime_type: str | None = None,
    classification: str | None = None,
    folder_id: UUID | None = None,
    owner_id: UUID | None = None,
    keyword: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
):
    vis_clause = await build_document_visibility_clause(user, db)
    query = select(Document).where(vis_clause)

    if owner_id:
        visible_owners = await get_visible_owner_ids(user, db)
        if visible_owners is not None and owner_id not in visible_owners:
            return []
        query = query.where(Document.user_id == owner_id)

    cleaned_q = q.strip() if q else ""
    if cleaned_q:
        tsquery = func.websearch_to_tsquery("simple", cleaned_q)
        like_pattern = f"%{cleaned_q}%"
        query = query.where(
            or_(
                Document.search_vector.op("@@")(tsquery),
                Document.extracted_text.ilike(like_pattern),
                Document.file_name.ilike(like_pattern),
                Document.summary.ilike(like_pattern),
                Document.classification.ilike(like_pattern),
                Document.department.ilike(like_pattern),
            )
        )
    if department:
        query = query.where(Document.department == department)
    if mime_type:
        query = query.where(Document.mime_type == mime_type)
    if classification:
        query = query.where(Document.classification == classification)
    if folder_id:
        query = query.where(Document.folder_id == folder_id)
    if keyword:
        query = query.where(Document.keywords.contains([keyword]))
    if from_date:
        try:
            query = query.where(Document.created_at >= datetime.combine(date.fromisoformat(from_date), time.min, tzinfo=timezone.utc))
        except ValueError:
            raise HTTPException(422, "from_date must use YYYY-MM-DD")
    if to_date:
        try:
            query = query.where(Document.created_at < datetime.combine(date.fromisoformat(to_date) + timedelta(days=1), time.min, tzinfo=timezone.utc))
        except ValueError:
            raise HTTPException(422, "to_date must use YYYY-MM-DD")

    breadcrumbs = await build_folder_breadcrumbs(db)

    if cleaned_q:
        tsquery = func.websearch_to_tsquery("simple", cleaned_q)
        query = query.order_by(func.ts_rank(Document.search_vector, tsquery).desc(), Document.created_at.desc())
        headline = func.ts_headline(
            "simple",
            func.coalesce(Document.extracted_text, ""),
            tsquery,
            "StartSel=⟦, StopSel=⟧, MaxWords=34, MinWords=12",
        )
        pairs = (await db.execute(query.add_columns(headline.label("hit_snippet")).limit(limit))).all()
        owner_map = await build_user_display_map(db, {d.user_id for d, _ in pairs})
        results = []
        for d, hit_snippet in pairs:
            folder_breadcrumb, folder_path = format_document_path(d.folder_id, d.file_name, breadcrumbs)
            snippet = _build_highlighted_snippet(d.extracted_text, cleaned_q, hit_snippet) or (d.summary or "")
            owner_info = owner_map.get(d.user_id)
            can_manage = user.role == UserRole.ADMIN or (user.role != UserRole.VIEWER and d.user_id == user.id)
            results.append(
                {
                    "id": str(d.id),
                    "file_name": d.file_name,
                    "mime_type": d.mime_type,
                    "file_size": d.file_size,
                    "summary": d.summary,
                    "snippet": snippet,
                    "status": d.processing_status,
                    "classification": d.classification,
                    "department": d.department,
                    "keywords": d.keywords,
                    "folder_id": str(d.folder_id) if d.folder_id else None,
                    "folder_breadcrumb": folder_breadcrumb,
                    "folder_path": folder_path,
                    "owner_id": str(d.user_id),
                    "owner_name": owner_info["display_name"] if owner_info else None,
                    "owner_username": owner_info["username"] if owner_info else None,
                    "owner_job_title": owner_info["job_title"] if owner_info else None,
                    "can_manage": can_manage,
                    "created_at": d.created_at,
                }
            )
        return results

    rows = (await db.scalars(query.order_by(Document.created_at.desc()).limit(limit))).all()
    owner_map = await build_user_display_map(db, {d.user_id for d in rows})
    results = []
    for d in rows:
        folder_breadcrumb, folder_path = format_document_path(d.folder_id, d.file_name, breadcrumbs)
        owner_info = owner_map.get(d.user_id)
        can_manage = user.role == UserRole.ADMIN or (user.role != UserRole.VIEWER and d.user_id == user.id)
        results.append(
            {
                "id": str(d.id),
                "file_name": d.file_name,
                "mime_type": d.mime_type,
                "file_size": d.file_size,
                "summary": d.summary,
                "snippet": (d.extracted_text or "")[:320],
                "status": d.processing_status,
                "classification": d.classification,
                "department": d.department,
                "keywords": d.keywords,
                "folder_id": str(d.folder_id) if d.folder_id else None,
                "folder_breadcrumb": folder_breadcrumb,
                "folder_path": folder_path,
                "owner_id": str(d.user_id),
                "owner_name": owner_info["display_name"] if owner_info else None,
                "owner_username": owner_info["username"] if owner_info else None,
                "owner_job_title": owner_info["job_title"] if owner_info else None,
                "can_manage": can_manage,
                "created_at": d.created_at,
            }
        )
    return results
