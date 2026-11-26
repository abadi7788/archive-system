"""UTC calendar-day request budgets, shared across all workers via PostgreSQL.

Reserve before contacting Google, counting attempted requests (including failures).
Resets are lazy at the UTC day boundary; no scheduler or application restart is needed.
The estimate cannot include requests made outside this installation.
"""
import hashlib
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from app.db import SessionLocal
from app.models.gemini_usage import GeminiUsage


def fingerprint(value: str) -> str:
    return hashlib.sha256(value.strip().encode()).hexdigest()


def reset_day(row: GeminiUsage, today=None) -> None:
    today = today or datetime.now(timezone.utc).date()
    if row.usage_day != today:
        row.usage_day = today
        row.requests_used = 0
        row.quota_exhausted = False


async def locked_usage(db, value: str) -> GeminiUsage:
    key = fingerprint(value)
    today = datetime.now(timezone.utc).date()
    await db.execute(insert(GeminiUsage).values(
        fingerprint=key, usage_day=today, requests_used=0, daily_limit=1500, quota_exhausted=False
    ).on_conflict_do_nothing(index_elements=[GeminiUsage.fingerprint]))
    row = await db.scalar(select(GeminiUsage).where(GeminiUsage.fingerprint == key).with_for_update())
    reset_day(row, today)
    return row


async def reserve_request(value: str) -> bool:
    async with SessionLocal() as db:
        row = await locked_usage(db, value)
        allowed = not row.provider_disabled and not row.quota_exhausted and row.requests_used < row.daily_limit
        if allowed:
            row.requests_used += 1
        await db.commit()
        return allowed


async def mark_exhausted(value: str) -> None:
    async with SessionLocal() as db:
        row = await locked_usage(db, value)
        row.quota_exhausted = True
        await db.commit()


async def usage_snapshot(db, value: str) -> dict:
    # Read-only projection resets displayed values immediately, without write locks.
    row = await db.get(GeminiUsage, fingerprint(value))
    today = datetime.now(timezone.utc).date()
    current = row is not None and row.usage_day == today
    used = row.requests_used if current else 0
    limit = row.daily_limit if row else 1500
    exhausted = bool(current and row.quota_exhausted) or used >= limit
    return {"requests_today": used, "daily_limit": limit, "remaining_estimate": max(0, limit-used),
            "status": "disabled" if row and row.provider_disabled else "limited" if exhausted else "active", "usage_day": today.isoformat(), "reset_timezone": "UTC"}


async def mark_disabled(value: str) -> None:
    async with SessionLocal() as db:
        row = await locked_usage(db, value)
        row.provider_disabled = True
        await db.commit()
