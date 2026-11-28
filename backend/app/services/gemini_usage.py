"""Shared UTC budgets and bounded provider cooldowns. Never store raw provider errors."""
import hashlib
from datetime import datetime, timedelta, timezone
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
        if row.last_error_code == 'provider_daily_limit':
            row.last_error_code = None
        # A minute-scale limit can legitimately cross midnight.


async def locked_usage(db, value: str) -> GeminiUsage:
    key = fingerprint(value)
    today = datetime.now(timezone.utc).date()
    await db.execute(insert(GeminiUsage).values(
        fingerprint=key, usage_day=today, requests_used=0, daily_limit=1500, quota_exhausted=False
    ).on_conflict_do_nothing(index_elements=[GeminiUsage.fingerprint]))
    row = await db.scalar(select(GeminiUsage).where(GeminiUsage.fingerprint == key).with_for_update())
    reset_day(row, today)
    return row


async def reserve_request(value: str, *, probe: bool = False) -> bool:
    async with SessionLocal() as db:
        row = await locked_usage(db, value)
        cooling = row.retry_after is not None and row.retry_after > datetime.now(timezone.utc)
        # An explicit administrator connectivity test may recheck provider state,
        # but never bypass the installation's own daily request budget.
        allowed = row.requests_used < row.daily_limit and (probe or not (row.provider_disabled or row.quota_exhausted or cooling))
        if allowed:
            row.requests_used += 1
        await db.commit()
        return allowed


async def mark_exhausted(value: str, retry_seconds: float = 60, *, daily: bool = False) -> None:
    async with SessionLocal() as db:
        row = await locked_usage(db, value)
        row.quota_exhausted = daily
        row.retry_after = datetime.now(timezone.utc) + timedelta(seconds=max(5, min(3600, retry_seconds))) if not daily else None
        row.last_error_code = 'provider_daily_limit' if daily else 'rate_limited'
        row.checked_at = datetime.now(timezone.utc)
        await db.commit()


async def record_result(value: str, code: str) -> None:
    assert code in {'ready', 'invalid_key', 'model_unavailable', 'provider_unavailable', 'network_error', 'invalid_response', 'region_unsupported'}
    async with SessionLocal() as db:
        row = await locked_usage(db, value)
        row.last_error_code = code
        row.checked_at = datetime.now(timezone.utc)
        if code == 'ready':
            row.provider_disabled = False
            row.quota_exhausted = False
            row.retry_after = None
        elif code == 'invalid_key':
            row.provider_disabled = True
        else:
            row.retry_after = datetime.now(timezone.utc) + timedelta(seconds=60)
        await db.commit()


async def usage_snapshot(db, value: str) -> dict:
    row = await db.get(GeminiUsage, fingerprint(value))
    now = datetime.now(timezone.utc)
    current = row is not None and row.usage_day == now.date()
    used = row.requests_used if current else 0
    limit = row.daily_limit if row else 1500
    cooling = bool(row and row.retry_after and row.retry_after > now)
    reason = row.last_error_code if row and row.last_error_code else 'unchecked'
    if not current and reason == 'provider_daily_limit':
        reason = 'unchecked'
    if row and row.provider_disabled:
        reason = 'invalid_key'
    elif used >= limit:
        reason = 'daily_limit'
    elif current and row.quota_exhausted:
        reason = 'provider_daily_limit'
    elif cooling:
        reason = row.last_error_code or 'rate_limited'
    status = 'disabled' if row and row.provider_disabled else 'limited' if reason in {'daily_limit', 'provider_daily_limit'} or cooling else 'active'
    return {'requests_today': used, 'daily_limit': limit, 'remaining_estimate': max(0, limit-used),
            'status': status, 'reason': reason, 'retry_at': row.retry_after.isoformat() if cooling else None,
            'checked_at': row.checked_at.isoformat() if row and row.checked_at else None,
            'usage_day': now.date().isoformat(), 'reset_timezone': 'UTC'}


async def mark_disabled(value: str) -> None:
    await record_result(value, 'invalid_key')
