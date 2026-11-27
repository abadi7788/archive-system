"""Worker scheduling tests: no provider calls or database required."""
import asyncio
import unittest
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, patch


class OCRRetrySchedulingTests(unittest.IsolatedAsyncioTestCase):
    async def test_drains_batches_periodically_and_wakes_without_manual_reindex(self):
        from app.services import ocr_retry
        from app.core.config import settings
        called = asyncio.Queue()
        calls = []

        async def batch(cursor=None):
            calls.append(cursor)
            await called.put(len(calls))
            # A full first batch must be followed immediately, without waiting for the interval.
            return ('cursor-one' if len(calls) == 1 else None), True

        @asynccontextmanager
        async def session():
            yield object()

        task = None
        try:
            with patch.object(settings, 'ocr_retry_interval_seconds', .02), patch.object(ocr_retry, 'SessionLocal', session), patch('app.api.uploads.cleanup_uploads', AsyncMock()), patch.object(ocr_retry, 'retry_pending_batch', side_effect=batch):
                task = asyncio.create_task(ocr_retry.retry_queued_documents())
                for _ in range(3):
                    await asyncio.wait_for(called.get(), timeout=1)
                self.assertEqual(calls[:3], [None, 'cursor-one', None])
                # With a long interval a new key still starts the next sweep immediately.
                settings.ocr_retry_interval_seconds = 3600
                ocr_retry.request_ocr_retry()
                await asyncio.wait_for(called.get(), timeout=1)
                self.assertGreaterEqual(len(calls), 4)
                ocr_retry.request_ocr_retry()
                await asyncio.wait_for(called.get(), timeout=1)
        finally:
            if task:
                task.cancel()
                with self.assertRaises(asyncio.CancelledError):
                    await task
        self.assertIsNone(ocr_retry._wake_event)
        ocr_retry.request_ocr_retry()  # safe before startup / after shutdown
