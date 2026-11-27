"""Opt-in PostgreSQL integration tests. Never point these at a production database.

Set DATABASE_URL and TEST_DATABASE_URL to the same disposable database ending in
_test, set normal application secrets, install httpx, and run unittest discovery.
Provider responses are mocked: no real Gemini credentials or charges are needed.
"""
import asyncio
import os
import uuid
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

ENABLED = bool(os.environ.get('TEST_DATABASE_URL'))


@unittest.skipUnless(ENABLED, 'Requires an explicitly configured disposable PostgreSQL database')
class AdminAuditIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        from sqlalchemy.engine import make_url
        from app.core.config import settings
        assert settings.sqlalchemy_database_url == os.environ['TEST_DATABASE_URL']
        assert make_url(settings.sqlalchemy_database_url).database.endswith('_test'), 'Refusing non-test database'
        from app.db import engine, SessionLocal
        from app.models import Base
        from app.models.user import User, UserRole
        from app.core.security import hash_password, create_access_token
        from app.main import app
        import httpx
        self.engine = engine
        self.Session = SessionLocal
        self.prefix = uuid.uuid4().hex
        self.password = 'Example-test-Password42'
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with self.Session() as db:
            self.admin = User(username='admin_' + self.prefix, full_name='Test administrator', password_hash=hash_password(self.password), role=UserRole.ADMIN)
            self.viewer = User(username='viewer_' + self.prefix, password_hash=hash_password(self.password), role=UserRole.VIEWER)
            db.add_all([self.admin, self.viewer])
            await db.commit()
        self.headers = {'Authorization': 'Bearer ' + create_access_token(str(self.admin.id))}
        self.viewer_headers = {'Authorization': 'Bearer ' + create_access_token(str(self.viewer.id))}
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app, client=('192.0.2.20', 45678)), base_url='http://test')

    async def asyncTearDown(self):
        await self.client.aclose()
        await self.engine.dispose()

    async def test_login_failure_success_logout_and_audit_filters(self):
        username = self.admin.username
        response = await self.client.post('/api/v1/auth/login', data={'username': username, 'password': 'wrong'})
        self.assertEqual(response.status_code, 401)
        response = await self.client.post('/api/v1/auth/login', data={'username': username, 'password': self.password})
        self.assertEqual(response.status_code, 200, response.text)
        response = await self.client.post('/api/v1/auth/logout', headers=self.headers)
        self.assertEqual(response.status_code, 200, response.text)
        response = await self.client.get('/api/v1/audit', params={'employee': 'Test administrator', 'action': 'auth.', 'from_date': datetime.now(timezone.utc).date().isoformat()}, headers=self.headers)
        self.assertEqual(response.status_code, 200, response.text)
        events = response.json()
        self.assertTrue({'auth.login_failed', 'auth.login', 'auth.logout'}.issubset({event['action'] for event in events}))
        for event in events:
            self.assertEqual(event['ip_address'], '192.0.2.20')
            self.assertEqual(event['actor_name'], 'Test administrator')
            self.assertNotIn(self.password, str(event))
        self.assertEqual((await self.client.get('/api/v1/audit', headers=self.viewer_headers)).status_code, 403)
        self.assertEqual((await self.client.get('/api/v1/audit', params={'from_date': '2026-12-01', 'to_date': '2026-01-01'}, headers=self.headers)).status_code, 422)

    async def test_key_crud_masking_authorization_and_concurrent_reservations(self):
        from app.services.gemini_usage import reserve_request
        key = 'test-secret-' + self.prefix
        response = await self.client.post('/api/v1/admin/gemini-keys', json={'label': self.prefix, 'api_key': key, 'daily_limit': 3}, headers=self.headers)
        self.assertEqual(response.status_code, 201, response.text)
        key_id = response.json()['id']
        results = await asyncio.gather(*(reserve_request(key) for _ in range(12)))
        self.assertEqual(sum(results), 3, 'Concurrent callers must not overspend the shared budget')
        response = await self.client.get('/api/v1/admin/gemini-keys', headers=self.headers)
        self.assertNotIn(key, response.text)
        row = next(row for row in response.json() if row['id'] == key_id)
        self.assertEqual(row['requests_today'], 3)
        self.assertEqual(row['remaining_estimate'], 0)
        self.assertEqual(row['status'], 'limited')
        response = await self.client.patch('/api/v1/admin/gemini-keys/' + key_id, json={'daily_limit': 5, 'is_active': False}, headers=self.headers)
        self.assertEqual(response.status_code, 200, response.text)
        response = await self.client.get('/api/v1/admin/gemini-keys', headers=self.headers)
        self.assertEqual(next(row for row in response.json() if row['id'] == key_id)['status'], 'disabled')
        self.assertEqual((await self.client.post('/api/v1/admin/gemini-keys', json={'label': 'Denied', 'api_key': key}, headers=self.viewer_headers)).status_code, 403)
        response = await self.client.delete('/api/v1/admin/gemini-keys/' + key_id, headers=self.headers)
        self.assertEqual(response.status_code, 200)

    async def test_daily_reset_and_budget_failover(self):
        from app.core.security import encrypt_secret
        from app.services.gemini_usage import locked_usage, reserve_request, usage_snapshot
        from app.services.gemini_service import GeminiOCRService
        from app.models.system_api_key import SystemAPIKey
        from sqlalchemy import func, select
        personal = 'personal-' + self.prefix
        fallback = 'fallback-' + self.prefix
        async with self.Session() as db:
            usage = await locked_usage(db, personal)
            usage.daily_limit = 1
            usage.requests_used = 1
            usage.usage_day = datetime.now(timezone.utc).date() - timedelta(days=1)
            usage.quota_exhausted = True
            await db.commit()
        self.assertTrue(await reserve_request(personal), 'UTC day rollover must clear yesterday’s counters and quota flag')
        self.assertFalse(await reserve_request(personal))
        async with self.Session() as db:
            priority = int(await db.scalar(select(func.max(SystemAPIKey.priority))) or 0) + 1
            db.add(SystemAPIKey(label=self.prefix, key_encrypted=encrypt_secret(fallback), priority=priority, is_active=True))
            await db.commit()
        calls = []
        def client(api_key, **kwargs):
            calls.append(api_key)
            return SimpleNamespace(aio=SimpleNamespace(models=SimpleNamespace(generate_content=AsyncMock(return_value=SimpleNamespace(text='An answer'))), aclose=AsyncMock()))
        # Load only our database key, but leave real SQL budget accounting enabled.
        with patch('app.services.gemini_service.load_active_db_gemini_keys', AsyncMock(return_value=[('db-test', fallback)])), patch('app.services.gemini_service.genai.Client', side_effect=client):
            result = await GeminiOCRService().ask_document('Question', 'Document text', user_key_encrypted=encrypt_secret(personal))
        self.assertEqual(calls, [fallback])
        self.assertEqual(result['processed_by_key'], 'db-test')
        async with self.Session() as db:
            self.assertEqual((await usage_snapshot(db, fallback))['requests_today'], 1)

    async def test_user_key_and_print_permission_and_password_audit(self):
        from app.models.document import Document
        from app.core.security import decrypt_secret
        key = 'personal-test-' + self.prefix
        response = await self.client.patch('/api/v1/users/' + str(self.viewer.id), json={'gemini_api_key': key, 'can_print': False}, headers=self.headers)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertNotIn(key, response.text)
        async with self.Session() as db:
            from app.models.user import User
            self.viewer = await db.get(User, self.viewer.id)
            self.assertEqual(decrypt_secret(self.viewer.gemini_key_encrypted), key)
            doc = Document(user_id=self.viewer.id, file_name='Test.pdf', file_path='test/' + self.prefix, mime_type='application/pdf', file_size=10, processing_status='completed')
            db.add(doc)
            await db.commit()
        path = '/api/v1/documents/' + str(doc.id) + '/print'
        self.assertEqual((await self.client.post(path, headers=self.viewer_headers)).status_code, 403)
        self.assertEqual((await self.client.post(path, headers=self.headers)).status_code, 200)
        response = await self.client.post('/api/v1/auth/change-password', json={'current_password': self.password, 'new_password': self.password + 'Changed'}, headers=self.headers)
        self.assertEqual(response.status_code, 200, response.text)
        response = await self.client.get('/api/v1/audit', params={'action': 'document.print_requested'}, headers=self.headers)
        self.assertTrue(any(row['resource_id'] == str(doc.id) for row in response.json()))
        response = await self.client.patch('/api/v1/users/' + str(self.viewer.id), json={'gemini_api_key': ''}, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        async with self.Session() as db:
            from app.models.user import User
            self.viewer = await db.get(User, self.viewer.id)
            self.assertIsNone(self.viewer.gemini_key_encrypted)

    async def test_quota_response_switches_keys_and_marks_provider_limit(self):
        from app.services.gemini_service import GeminiOCRService
        from app.services.gemini_usage import usage_snapshot
        first, second = 'quota-first-' + self.prefix, 'quota-second-' + self.prefix
        calls = []
        def client(api_key, **kwargs):
            async def generate(**kwargs):
                calls.append(api_key)
                if api_key == first:
                    raise RuntimeError('429 RESOURCE_EXHAUSTED')
                return SimpleNamespace(text='{"extracted_text":"Verified text"}')
            return SimpleNamespace(aio=SimpleNamespace(models=SimpleNamespace(generate_content=generate), aclose=AsyncMock()))
        with patch('app.services.gemini_service.load_active_db_gemini_keys', AsyncMock(return_value=[('first', first), ('second', second)])), patch('app.services.gemini_service.genai.Client', side_effect=client):
            result = await GeminiOCRService().extract(b'fake-image', 'image/png')
        self.assertEqual(result['extracted_text'], 'Verified text')
        self.assertEqual(calls, [first, second])
        async with self.Session() as db:
            state = await usage_snapshot(db, first)
            self.assertEqual(state['status'], 'limited')
            self.assertEqual(state['requests_today'], 1)

    async def test_ocr_job_lock_prevents_duplicate_processing(self):
        from app.models.document import Document
        from app.api.documents import run_ocr_background
        async with self.Session() as db:
            doc = Document(user_id=self.admin.id, file_name='Queued.png', file_path='test-queued/' + self.prefix,
                           mime_type='image/png', file_size=10, processing_status='queued')
            db.add(doc)
            await db.commit()
        async def extraction(*args, **kwargs):
            await asyncio.sleep(0.05)
            return {'extracted_text': 'Indexed exactly once'}
        provider = AsyncMock(side_effect=extraction)
        with patch('app.api.documents.GeminiOCRService.extract', provider), patch('app.api.documents.get_storage', return_value=SimpleNamespace(get=AsyncMock(return_value=b'image'))):
            await asyncio.gather(*(run_ocr_background(doc.id, doc.file_path, doc.mime_type) for _ in range(3)))
        self.assertEqual(provider.await_count, 1)
        async with self.Session() as db:
            saved = await db.get(Document, doc.id)
            self.assertEqual(saved.processing_status, 'completed')
            self.assertEqual(saved.extracted_text, 'Indexed exactly once')

    async def test_safe_change_details_and_folder_mutation_fallback(self):
        from app.models.folder import Folder
        response = await self.client.patch('/api/v1/users/' + str(self.viewer.id), json={'full_name': 'Changed display name', 'can_print': True}, headers=self.headers)
        self.assertEqual(response.status_code, 200, response.text)
        response = await self.client.get('/api/v1/audit', params={'action': 'user.updated'}, headers=self.headers)
        event = next(item for item in response.json() if item['resource_id'] == str(self.viewer.id))
        self.assertTrue(event['detail']['changes'])
        self.assertIn('can_print', str(event['detail']))
        self.assertNotIn(self.password, str(event['detail']))
        response = await self.client.post('/api/v1/folders', json={'name': 'Audit folder ' + self.prefix}, headers=self.headers)
        self.assertEqual(response.status_code, 201, response.text)
        events = (await self.client.get('/api/v1/audit', headers=self.headers)).json()
        self.assertTrue(any('Audit folder ' + self.prefix in str(item['detail']) for item in events))


    async def test_validation_never_echoes_submitted_secrets(self):
        secret = 'short-secret'
        response = await self.client.post('/api/v1/admin/gemini-keys', json={'label': 'Invalid', 'api_key': secret}, headers=self.headers)
        self.assertEqual(response.status_code, 422)
        self.assertNotIn(secret, response.text)
        self.assertNotIn('input', response.json()['detail'][0])

    async def test_automatic_retry_recovers_queued_and_abandoned_processing_jobs(self):
        from app.models.document import Document
        from app.services.ocr_retry import retry_pending_batch
        from app.core.config import settings
        from app.services.gemini_service import AllGeminiKeysExhausted, GeminiRequestFailed
        from app.api.documents import run_ocr_background
        for initial_status in ['queued', 'processing']:
            async with self.Session() as db:
                doc = Document(user_id=self.admin.id, file_name='Retry.png', file_path=f'retry/{self.prefix}/{initial_status}',
                               mime_type='image/png', file_size=10, processing_status=initial_status)
                db.add(doc)
                await db.commit()
            cursor_before = uuid.UUID(int=doc.id.int - 1)
            provider = AsyncMock(side_effect=[AllGeminiKeysExhausted([]), GeminiRequestFailed('Temporary provider outage'), {'extracted_text': 'Automatically indexed'}])
            with patch.object(settings, 'ocr_retry_batch_size', 1), patch('app.api.documents.GeminiOCRService.extract', provider), patch('app.api.documents.get_storage', return_value=SimpleNamespace(get=AsyncMock(return_value=b'image'))):
                for expected in ['queued', 'queued', 'completed']:
                    cursor, acquired = await retry_pending_batch(cursor_before)
                    self.assertTrue(acquired)
                    self.assertEqual(cursor, doc.id)
                    async with self.Session() as db:
                        self.assertEqual((await db.get(Document, doc.id)).processing_status, expected)
                # A completed job is not indexed twice, even when an upload task races the worker.
                await run_ocr_background(doc.id, doc.file_path, doc.mime_type)
                self.assertEqual(provider.await_count, 3)
            async with self.Session() as db:
                saved = await db.get(Document, doc.id)
                self.assertEqual(saved.extracted_text, 'Automatically indexed')
                self.assertIsNone(saved.processing_error)

    async def test_gemini_key_changes_wake_automatic_indexing_after_commit(self):
        from app.models.system_api_key import SystemAPIKey
        async def confirm_committed():
            async with self.Session() as db:
                from sqlalchemy import select
                self.assertIsNotNone(await db.scalar(select(SystemAPIKey).where(SystemAPIKey.label == 'Wake ' + self.prefix)))
        # A synchronous notifier can only run after the request has committed.
        with patch('app.api.admin.request_ocr_retry') as wake:
            response = await self.client.post('/api/v1/admin/gemini-keys', headers=self.headers,
                                             json={'label': 'Wake ' + self.prefix, 'api_key': 'AIzaTestWakeKey_' + self.prefix, 'daily_limit': 20})
            self.assertEqual(response.status_code, 201, response.text)
            wake.assert_called_once()
            await confirm_committed()
            response = await self.client.patch('/api/v1/admin/gemini-keys/' + response.json()['id'], headers=self.headers, json={'daily_limit': 40})
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(wake.call_count, 2)
