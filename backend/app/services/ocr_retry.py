"""Automatic indexing recovery, periodic retries and immediate key-change wakeups."""
import asyncio
import logging
from sqlalchemy import select, text
from app.core.config import settings
from app.db import SessionLocal
from app.models.document import Document

logger = logging.getLogger(__name__)
_wake_event: asyncio.Event | None = None


def request_ocr_retry() -> None:
    """Signal the worker after a committed key change; never index inside an API request."""
    if _wake_event is not None:
        _wake_event.set()


async def retry_pending_batch(cursor=None):
    from app.api.documents import run_ocr_background
    async with SessionLocal() as db:
        async with db.begin():
            # Serialize batches across replicas. Each document also has its own lock.
            if not await db.scalar(text('SELECT pg_try_advisory_xact_lock(726195)')):
                return None, False
            query = select(Document).where(Document.processing_status.in_(['queued', 'processing']), Document.deleted_at.is_(None))
            if cursor is not None:
                query = query.where(Document.id > cursor)
            jobs = (await db.scalars(query.order_by(Document.id).limit(settings.ocr_retry_batch_size))).all()
            for doc in jobs:
                # The per-document lock skips live processing and recovers abandoned jobs.
                await run_ocr_background(doc.id, doc.file_path, doc.mime_type)
            return (jobs[-1].id if jobs else None), True


async def retry_queued_documents():
    global _wake_event
    event = asyncio.Event()
    _wake_event = event
    try:
        while True:
            event.clear()
            delay = settings.ocr_retry_interval_seconds
            try:
                from app.api.uploads import cleanup_uploads
                async with SessionLocal() as cleanup_db:
                    await cleanup_uploads(cleanup_db)
                # Drain a complete fair sweep in bounded batches, not just the first 20 jobs.
                cursor = None
                while True:
                    cursor, acquired = await retry_pending_batch(cursor)
                    if not acquired:
                        delay = min(delay, 5)  # another replica is working; retry without losing the wakeup
                    if cursor is None:
                        break
                    await asyncio.sleep(0)  # allow key notifications and shutdown between batches
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning('Pending indexing retry failed (%s)', type(exc).__name__)
            # An event received during a sweep remains set, so the next sweep starts now.
            try:
                await asyncio.wait_for(event.wait(), timeout=delay)
            except asyncio.TimeoutError:
                pass
    finally:
        if _wake_event is event:
            _wake_event = None
