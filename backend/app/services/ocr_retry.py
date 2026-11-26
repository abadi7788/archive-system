"""Periodic retry of quota-queued OCR jobs; no external scheduler required."""
import asyncio
import logging
from sqlalchemy import select, text
from app.db import SessionLocal
from app.models.document import Document

logger = logging.getLogger(__name__)


async def retry_queued_documents():
    from app.api.documents import run_ocr_background
    cursor = None
    while True:
        try:
            from app.api.uploads import cleanup_uploads
            async with SessionLocal() as cleanup_db:
                await cleanup_uploads(cleanup_db)
            # Leader election across workers; transaction lock always releases.
            async with SessionLocal() as db:
                async with db.begin():
                    acquired = await db.scalar(text('SELECT pg_try_advisory_xact_lock(726195)'))
                    if acquired:
                        query = select(Document).where(Document.processing_status == 'queued', Document.deleted_at.is_(None))
                        if cursor is not None:
                            query = query.where(Document.id > cursor)
                        jobs = (await db.scalars(query.order_by(Document.id).limit(20))).all()
                        cursor = jobs[-1].id if jobs else None
                        for doc in jobs:
                            await run_ocr_background(doc.id, doc.file_path, doc.mime_type)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning('Queued OCR retry failed (%s)', type(exc).__name__)
        await asyncio.sleep(60)
