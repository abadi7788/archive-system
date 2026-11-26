"""Disposable PostgreSQL + temporary encrypted storage; providers are not contacted."""
import asyncio
import io
import os
import tempfile
import unittest
import uuid
import zipfile
from unittest.mock import AsyncMock, patch
from datetime import datetime, timedelta, timezone
import test_admin_audit_integration as fixtures


@unittest.skipUnless(fixtures.ENABLED, 'Requires disposable PostgreSQL ending in _test')
class UploadRenameTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = fixtures.AdminAuditIntegrationTests.asyncSetUp
    asyncTearDown = fixtures.AdminAuditIntegrationTests.asyncTearDown

    async def create_upload(self, name, size, **options):
        response = await self.client.post('/api/v1/uploads', headers=self.headers,
            json={'file_name': name, 'file_size': size, **options})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()['id']

    async def send_file(self, name, data=b'example text', **options):
        uid = await self.create_upload(name, len(data), **options)
        response = await self.client.put(f'/api/v1/uploads/{uid}?offset=0', headers=self.headers, content=data)
        self.assertEqual(response.status_code, 200, response.text)
        with patch('app.api.documents.run_ocr_background', new=AsyncMock()):
            result = await self.client.post(f'/api/v1/uploads/{uid}/complete', headers=self.headers)
        self.assertEqual(result.status_code, 200, result.text)
        return result.json()

    async def test_chunk_resume_retry_ownership_and_idempotent_completion(self):
        from app.api.uploads import path_for
        from app.models.audit_log import AuditLog
        from sqlalchemy import select
        uid = await self.create_upload(f'{self.prefix}.txt', 10, department='Finance')
        self.assertEqual((await self.client.get(f'/api/v1/uploads/{uid}', headers=self.viewer_headers)).status_code, 403)
        response = await self.client.put(f'/api/v1/uploads/{uid}?offset=0', headers=self.headers, content=b'first')
        self.assertEqual(response.json()['received'], 5)
        response = await self.client.put(f'/api/v1/uploads/{uid}?offset=0', headers=self.headers, content=b'first')
        self.assertEqual(response.json()['received'], 5)
        self.assertNotIn(b'first', path_for(uid).read_bytes())
        self.assertEqual((await self.client.put(f'/api/v1/uploads/{uid}?offset=0', headers=self.headers, content=b'wrong')).status_code, 409)
        self.assertEqual((await self.client.post(f'/api/v1/uploads/{uid}/complete', headers=self.headers)).status_code, 409)
        self.assertEqual((await self.client.get(f'/api/v1/uploads/{uid}', headers=self.headers)).json()['received'], 5)
        await self.client.put(f'/api/v1/uploads/{uid}?offset=5', headers=self.headers, content=b'last!')
        with patch('app.api.documents.run_ocr_background', new=AsyncMock()):
            responses = await asyncio.gather(*[self.client.post(f'/api/v1/uploads/{uid}/complete', headers=self.headers) for _ in range(2)])
        self.assertTrue(all(r.status_code == 200 for r in responses), [r.text for r in responses])
        self.assertEqual(responses[0].json()['id'], responses[1].json()['id'])
        doc = responses[0].json()
        download = await self.client.get(f"/api/v1/documents/{doc['id']}/file", headers=self.headers)
        self.assertEqual(download.content, b'firstlast!')
        self.assertEqual(download.headers['content-length'], '10')
        self.assertFalse(path_for(uid).exists())
        async with self.Session() as db:
            logs = (await db.scalars(select(AuditLog).where(AuditLog.action == 'document.uploaded', AuditLog.resource_id == doc['id']))).all()
            self.assertEqual(len(logs), 1)

    async def test_more_than_40_mib_and_bigint_session_size(self):
        uid = await self.create_upload(f'large-{self.prefix}.txt', 41 * 1024 * 1024)
        for offset in range(0, 41 * 1024 * 1024, 4 * 1024 * 1024):
            chunk = b'A' * min(4 * 1024 * 1024, 41 * 1024 * 1024 - offset)
            response = await self.client.put(f'/api/v1/uploads/{uid}?offset={offset}', headers=self.headers, content=chunk)
            self.assertEqual(response.status_code, 200, response.text)
        complete = await self.client.post(f'/api/v1/uploads/{uid}/complete', headers=self.headers)
        self.assertEqual(complete.status_code, 200, complete.text)
        self.assertEqual(complete.json()['file_size'], 41 * 1024 * 1024)
        self.assertEqual(complete.json()['status'], 'stored')
        uid = await self.create_upload(f'5gb-{self.prefix}.pdf', 5 * 1024 ** 3)
        self.assertEqual((await self.client.delete(f'/api/v1/uploads/{uid}', headers=self.headers)).status_code, 204)

    async def test_content_validation_ooxml_txt_and_legacy_containers(self):
        from app.services.file_types import detect_file_type, extract_local_text, OOXML_PARTS
        for extension, part in OOXML_PARTS.items():
            stream = io.BytesIO()
            with zipfile.ZipFile(stream, 'w') as archive:
                archive.writestr('[Content_Types].xml', '<Types/>')
                archive.writestr(part, '<root><t>hello</t></root>')
            document = await self.send_file(self.prefix + extension, stream.getvalue())
            self.assertIn('openxmlformats', document['mime_type'])
        self.assertIsNone(detect_file_type(io.BytesIO(b'not an office file'), 'report.doc'))
        self.assertIsNone(detect_file_type(io.BytesIO(b'PK' + b'X' * 10), 'report.docx'))
        self.assertIsNone(detect_file_type(io.BytesIO(b'\x00\x01binary'), 'report.txt'))
        self.assertEqual(extract_local_text('نص عربي'.encode(), 'report.txt'), 'نص عربي')
        uid = await self.create_upload(self.prefix + '.pdf', 8)
        await self.client.put(f'/api/v1/uploads/{uid}?offset=0', headers=self.headers, content=b'fake pdf')
        self.assertEqual((await self.client.post(f'/api/v1/uploads/{uid}/complete', headers=self.headers)).status_code, 415)
        self.assertEqual((await self.client.post('/api/v1/uploads', headers=self.headers, json={'file_name': 'bad.exe', 'file_size': 1})).status_code, 415)

    async def test_rename_extension_collision_permissions_and_safe_audit(self):
        from sqlalchemy import select
        from app.models.audit_log import AuditLog
        doc = await self.send_file(self.prefix + '.txt')
        other = await self.send_file('duplicate-' + self.prefix + '.txt')
        endpoint = f"/api/v1/documents/{doc['id']}/rename"
        self.assertEqual((await self.client.patch(endpoint, headers=self.viewer_headers, json={'name': 'blocked'})).status_code, 403)
        for name in [' ', '../bad', 'CON', 'bad?name']:
            self.assertEqual((await self.client.patch(endpoint, headers=self.headers, json={'name': name})).status_code, 422)
        self.assertEqual((await self.client.patch(endpoint, headers=self.headers, json={'name': other['file_name']})).status_code, 409)
        response = await self.client.patch(endpoint, headers=self.headers, json={'name': 'تقرير-' + self.prefix})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['file_name'], 'تقرير-' + self.prefix + '.txt')
        # The general edit endpoint cannot bypass extension locking.
        response = await self.client.patch(f"/api/v1/documents/{doc['id']}", headers=self.headers, json={'file_name': 'new.pdf'})
        self.assertEqual(response.json()['file_name'], 'new.pdf.txt')
        async with self.Session() as db:
            logs = (await db.scalars(select(AuditLog).where(AuditLog.action == 'document.renamed', AuditLog.resource_id == doc['id']).order_by(AuditLog.created_at))).all()
            self.assertEqual(len(logs), 2)
            self.assertEqual(logs[0].detail['old_name'], doc['file_name'])
            self.assertEqual(logs[0].detail['actor_name'], 'Test administrator')

    async def test_folder_rename_validation_paths_and_preferences(self):
        first = await self.client.post('/api/v1/folders', headers=self.headers, json={'name': self.prefix})
        fid = first.json()['id']
        child = await self.client.post('/api/v1/folders', headers=self.headers, json={'name': 'child', 'parent_id': fid})
        self.assertEqual(child.status_code, 201, child.text)
        self.assertEqual((await self.client.patch(f'/api/v1/folders/{fid}', headers=self.headers, json={'name': '  '})).status_code, 422)
        self.assertEqual((await self.client.post('/api/v1/folders', headers=self.headers, json={'name': self.prefix.upper()})).status_code, 409)
        renamed = await self.client.patch(f'/api/v1/folders/{fid}', headers=self.headers, json={'name': 'renamed-' + self.prefix})
        self.assertEqual(renamed.status_code, 200, renamed.text)
        folders = (await self.client.get('/api/v1/folders', headers=self.headers)).json()
        self.assertEqual(next(f['path'] for f in folders if f['id'] == child.json()['id']), '/renamed-' + self.prefix)
        result = await self.client.patch('/api/v1/auth/preferences', headers=self.headers, json={'preferred_item_size': 240})
        self.assertEqual(result.json()['preferred_item_size'], 240)
        self.assertEqual((await self.client.patch('/api/v1/auth/preferences', headers=self.headers, json={'preferred_item_size': 500})).status_code, 422)

    async def test_multipart_compatibility_concurrent_names_and_expiry(self):
        from app.models.upload_session import UploadSession
        from app.api.uploads import cleanup_uploads, path_for
        with patch('app.api.documents.run_ocr_background', new=AsyncMock()):
            response = await self.client.post('/api/v1/documents/upload', headers=self.headers,
                files={'file': (self.prefix + '.txt', b'legacy multipart', 'text/plain')})
        self.assertEqual(response.status_code, 201, response.text)
        first, second = await asyncio.gather(*[self.client.post('/api/v1/folders', headers=self.headers,
            json={'name': 'same-' + self.prefix}) for _ in range(2)])
        self.assertEqual(sorted([first.status_code, second.status_code]), [201, 409])
        uid = await self.create_upload('expire-' + self.prefix + '.txt', 1)
        async with self.Session() as db:
            session = await db.get(UploadSession, uuid.UUID(uid))
            session.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
            await db.commit()
        self.assertEqual((await self.client.get(f'/api/v1/uploads/{uid}', headers=self.headers)).status_code, 410)
        async with self.Session() as db: await cleanup_uploads(db)
        self.assertFalse(path_for(uid).exists())

    async def test_upload_and_rename_denied_for_unrelated_archiver(self):
        from app.models.user import User, UserRole
        from app.core.security import create_access_token
        async with self.Session() as db:
            outsider = User(username='outsider-' + self.prefix, password_hash='not-used', role=UserRole.ARCHIVER)
            db.add(outsider); await db.commit()
            outsider_headers = {'Authorization': 'Bearer ' + create_access_token(str(outsider.id))}
        folder = (await self.client.post('/api/v1/folders', headers=self.headers, json={'name': self.prefix})).json()
        doc = await self.send_file(self.prefix + '.txt', folder_id=folder['id'])
        uid = await self.create_upload('private-' + self.prefix + '.txt', 1)
        self.assertEqual((await self.client.get(f'/api/v1/uploads/{uid}', headers=outsider_headers)).status_code, 404)
        self.assertEqual((await self.client.patch(f"/api/v1/documents/{doc['id']}/rename", headers=outsider_headers, json={'name': 'denied'})).status_code, 403)
        self.assertEqual((await self.client.patch(f"/api/v1/folders/{folder['id']}", headers=outsider_headers, json={'name': 'denied'})).status_code, 403)
        self.assertEqual((await self.client.post('/api/v1/uploads', headers=outsider_headers,
            json={'file_name': 'denied.txt', 'file_size': 1, 'folder_id': folder['id']})).status_code, 403)


class EncryptedRecordsTests(unittest.TestCase):
    def test_roundtrip_legacy_and_truncation_detection(self):
        from app.services.encrypted_stream import encrypt_file, decrypted_records
        from app.services.storage_service import LocalStorage
        from app.core.security import _fernet
        data = b'private' * 200000
        encrypted = io.BytesIO()
        encrypt_file(io.BytesIO(data), encrypted)
        raw = encrypted.getvalue()
        self.assertNotIn(b'private', raw)
        self.assertEqual(b''.join(decrypted_records(io.BytesIO(raw))), data)
        with self.assertRaises(ValueError): list(decrypted_records(io.BytesIO(raw[:-120])))
        # Different files have different nonces; records cannot be transplanted between them.
        other = io.BytesIO(); encrypt_file(io.BytesIO(data), other)
        with self.assertRaises(ValueError): list(decrypted_records(io.BytesIO(raw[:24] + other.getvalue()[24:])))
        with tempfile.TemporaryDirectory() as root, patch('app.services.storage_service.LOCAL_ROOT', __import__('pathlib').Path(root)):
            path = __import__('pathlib').Path(root) / 'old'
            path.write_bytes(_fernet().encrypt(data))
            self.assertEqual(b''.join(LocalStorage().iter_content('old')), data)


class S3StreamTests(unittest.IsolatedAsyncioTestCase):
    async def test_new_records_use_file_upload_and_stream_back(self):
        from app.services.storage_service import S3Storage
        from unittest.mock import MagicMock
        client = MagicMock()
        stored = {}
        def save(source, bucket, key, **kwargs): stored[key] = source.read()
        client.upload_fileobj.side_effect = save
        client.get_object.side_effect = lambda **kwargs: {'Body': io.BytesIO(stored[kwargs['Key']])}
        with patch('app.services.storage_service.boto3.client', return_value=client):
            storage = S3Storage()
            await storage.put_file('test', io.BytesIO(b'large-original' * 100000), 'text/plain')
            self.assertEqual(b''.join(storage.iter_content('test')), b'large-original' * 100000)
            self.assertNotIn(b'large-original', stored['test'])
