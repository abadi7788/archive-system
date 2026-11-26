"""Pairwise isolation, direction, ownership, revocation, directory hierarchy and migration."""
import asyncio
import io
import unittest
from unittest.mock import AsyncMock, patch
import test_admin_audit_integration as fixtures


@unittest.skipUnless(fixtures.ENABLED, 'Requires disposable PostgreSQL ending in _test')
class RelationshipTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = fixtures.AdminAuditIntegrationTests.asyncSetUp
    asyncTearDown = fixtures.AdminAuditIntegrationTests.asyncTearDown

    async def employees(self):
        from app.models.user import User, UserRole
        from app.core.security import create_access_token
        async with self.Session() as db:
            self.people = [User(username=f'employee_{index}_{self.prefix}', full_name=name, password_hash=self.admin.password_hash, role=UserRole.ARCHIVER) for index, name in enumerate(('أحمد', 'بدر', 'جمال'))]
            db.add_all(self.people)
            await db.commit()
        return [({'Authorization': 'Bearer ' + create_access_token(str(u.id))}, str(u.id)) for u in self.people]

    async def link(self, a, b, mode='mutual', access='read'):
        response = await self.client.post('/api/v1/relationships', headers=self.headers,
            json={'user_a_id': a, 'user_b_id': b, 'mode': mode, 'access': access})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    async def send(self, headers, name, **options):
        response = await self.client.post('/api/v1/uploads', headers=headers, json={'file_name': name, 'file_size': 5, **options})
        self.assertEqual(response.status_code, 201, response.text)
        uid = response.json()['id']
        await self.client.put(f'/api/v1/uploads/{uid}?offset=0', headers=headers, content=b'hello')
        with patch('app.api.documents.run_ocr_background', new=AsyncMock()):
            response = await self.client.post(f'/api/v1/uploads/{uid}/complete', headers=headers)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    async def test_pairwise_nontransitivity_and_personal_archive_default(self):
        (ha, a), (hb, b), (hc, c) = await self.employees()
        await self.link(a, b)
        await self.link(a, c)
        da, db, dc = [await self.send(h, n + '.txt') for h, n in ((ha, 'ألف'), (hb, 'باء'), (hc, 'جيم'))]
        for headers, own, expected in ((ha, da, {b, c}), (hb, db, {a}), (hc, dc, {a})):
            team = await self.client.get('/api/v1/relationships/team', headers=headers)
            self.assertEqual({row['id'] for row in team.json()}, expected)
            for path in ('/api/v1/search', '/api/v1/documents'):
                response = await self.client.get(path, headers=headers)
                self.assertEqual([row['id'] for row in response.json()], [own['id']])
        self.assertEqual((await self.client.get('/api/v1/search', params={'owner_id': c}, headers=hb)).status_code, 403)
        for path in (f"/api/v1/documents/{dc['id']}", f"/api/v1/documents/{dc['id']}/file"):
            self.assertEqual((await self.client.get(path, headers=hb)).status_code, 404)
        self.assertEqual((await self.client.post(f"/api/v1/documents/{dc['id']}/copy", headers=hb, json={})).status_code, 404)
        visible = (await self.client.get('/api/v1/search', params={'owner_id': b}, headers=ha)).json()
        self.assertEqual([row['id'] for row in visible], [db['id']])
        self.assertFalse(visible[0]['can_manage'])

    async def test_supervisory_hidden_readonly_and_copy(self):
        (ha, a), (hb, b), _ = await self.employees()
        await self.link(a, b, mode='supervisory')
        da, doc = await self.send(ha, 'manager.txt'), await self.send(hb, 'employee.txt')
        self.assertEqual((await self.client.get('/api/v1/relationships/team', headers=hb)).json(), [])
        owners = (await self.client.get('/api/v1/users/visible-owners', headers=hb)).json()
        self.assertEqual({u['id'] for u in owners}, {b})
        self.assertEqual((await self.client.get('/api/v1/relationships', headers=hb)).status_code, 403)
        self.assertEqual((await self.client.get(f"/api/v1/documents/{da['id']}/file", headers=hb)).status_code, 404)
        self.assertEqual((await self.client.get(f"/api/v1/documents/{doc['id']}/file", headers=ha)).content, b'hello')
        for method, path, body in [('PATCH', f"/api/v1/documents/{doc['id']}/rename", {'name': 'blocked'}), ('DELETE', f"/api/v1/documents/{doc['id']}", None), ('POST', '/api/v1/folders', {'name': 'blocked', 'owner_id': b}), ('POST', '/api/v1/uploads', {'file_name': 'blocked.txt', 'file_size': 5, 'owner_id': b})]:
            self.assertEqual((await self.client.request(method, path, headers=ha, json=body)).status_code, 403)
        with patch('app.api.documents.run_ocr_background', new=AsyncMock()):
            copy = await self.client.post(f"/api/v1/documents/{doc['id']}/copy", headers=ha, json={})
        self.assertEqual(copy.status_code, 201, copy.text)
        self.assertEqual(copy.json()['owner_id'], a)
        self.assertNotEqual(copy.json()['id'], doc['id'])
        self.assertEqual((await self.client.get(f"/api/v1/documents/{copy.json()['id']}/file", headers=ha)).content, b'hello')
        self.assertEqual((await self.client.get(f"/api/v1/documents/{copy.json()['id']}/file", headers=hb)).status_code, 404)

    async def test_full_control_ownership_reversal_revocation_and_audit(self):
        from sqlalchemy import select
        from app.models.audit_log import AuditLog
        (ha, a), (hb, b), _ = await self.employees()
        rel = await self.link(a, b, mode='supervisory', access='full')
        doc = await self.send(hb, 'original.txt')
        folder = await self.client.post('/api/v1/folders', headers=ha, json={'name': 'فريق', 'owner_id': b})
        self.assertEqual(folder.status_code, 201, folder.text)
        folder_id = folder.json()['id']
        uploaded = await self.send(ha, 'added-by-manager.txt', owner_id=b, folder_id=folder_id)
        self.assertEqual(uploaded['owner_id'], b)
        self.assertEqual((await self.client.patch(f"/api/v1/documents/{doc['id']}/rename", headers=ha, json={'name': 'new'})).status_code, 200)
        self.assertEqual((await self.client.patch(f'/api/v1/folders/{folder_id}', headers=ha, json={'name': 'جديد'})).status_code, 200)
        rows = (await self.client.get('/api/v1/search', params={'owner_id': b}, headers=ha)).json()
        self.assertTrue(all(row['can_manage'] for row in rows))
        payload = {'user_a_id': a, 'user_b_id': b, 'mode': 'supervisory', 'access': 'read'}
        self.assertEqual((await self.client.put('/api/v1/relationships/' + rel['id'], headers=self.headers, json=payload)).status_code, 200)
        self.assertEqual((await self.client.delete(f"/api/v1/documents/{doc['id']}", headers=ha)).status_code, 403)
        payload.update(user_a_id=b, user_b_id=a, access='full')
        self.assertEqual((await self.client.put('/api/v1/relationships/' + rel['id'], headers=self.headers, json=payload)).status_code, 200)
        self.assertEqual((await self.client.get('/api/v1/relationships/team', headers=ha)).json(), [])
        self.assertEqual((await self.client.get(f"/api/v1/documents/{doc['id']}/file", headers=ha)).status_code, 404)
        self.assertEqual((await self.client.delete('/api/v1/relationships/' + rel['id'], headers=self.headers)).status_code, 204)
        self.assertEqual((await self.client.get('/api/v1/relationships/team', headers=hb)).json(), [])
        async with self.Session() as db:
            events = (await db.scalars(select(AuditLog).where(AuditLog.resource_id == rel['id']))).all()
            self.assertEqual({e.action for e in events}, {'employee_relationship.created', 'employee_relationship.updated', 'employee_relationship.deleted'})
            self.assertTrue(all(e.detail.get('actor_name') == 'Test administrator' for e in events))
            update = next(e for e in events if e.action.endswith('updated'))
            self.assertIn('before', update.detail)
            self.assertIn('after', update.detail)

    async def test_full_deletion_viewer_ceiling_and_revoked_upload_completion(self):
        (ha, a), (hb, b), _ = await self.employees()
        rel = await self.link(a, b, access='full')
        doc = await self.send(hb, 'delete.txt')
        self.assertEqual((await self.client.delete(f"/api/v1/documents/{doc['id']}", headers=ha)).status_code, 204)
        folder = (await self.client.post('/api/v1/folders', headers=ha, json={'name': 'delete-folder', 'owner_id': b})).json()
        self.assertEqual((await self.client.delete('/api/v1/folders/' + folder['id'], headers=ha)).status_code, 204)
        upload = await self.client.post('/api/v1/uploads', headers=ha, json={'file_name': 'inflight.txt', 'file_size': 5, 'owner_id': b})
        self.assertEqual(upload.status_code, 201, upload.text)
        uid = upload.json()['id']
        await self.client.put(f'/api/v1/uploads/{uid}?offset=0', headers=ha, content=b'hello')
        await self.client.delete('/api/v1/relationships/' + rel['id'], headers=self.headers)
        self.assertEqual((await self.client.post(f'/api/v1/uploads/{uid}/complete', headers=ha)).status_code, 403)
        await self.link(str(self.viewer.id), b, access='full')
        team = (await self.client.get('/api/v1/relationships/team', headers=self.viewer_headers)).json()
        self.assertEqual(team[0]['access'], 'read')
        self.assertEqual((await self.client.post('/api/v1/folders', headers=self.viewer_headers, json={'name': 'blocked', 'owner_id': b})).status_code, 403)

    async def test_duplicate_pair_validation_and_unauthorized_management(self):
        (ha, a), (_, b), (_, c) = await self.employees()
        body = {'user_a_id': a, 'user_b_id': b, 'mode': 'mutual', 'access': 'read'}
        self.assertEqual((await self.client.post('/api/v1/relationships', headers=ha, json=body)).status_code, 403)
        responses = await asyncio.gather(*[self.client.post('/api/v1/relationships', headers=self.headers, json=body) for _ in range(2)])
        self.assertEqual(sorted(r.status_code for r in responses), [201, 409])
        body['user_a_id'], body['user_b_id'] = b, a
        self.assertEqual((await self.client.post('/api/v1/relationships', headers=self.headers, json=body)).status_code, 409)
        body['user_b_id'] = b
        self.assertEqual((await self.client.post('/api/v1/relationships', headers=self.headers, json=body)).status_code, 422)
        body['user_b_id'], body['mode'] = c, 'wrong'
        self.assertEqual((await self.client.post('/api/v1/relationships', headers=self.headers, json=body)).status_code, 422)

    async def test_directory_paths_reuse_isolation_validation_and_equal_leaf_names(self):
        (ha, a), (hb, b), (hc, c) = await self.employees()
        await self.link(a, b, access='full')
        body = {'owner_id': b, 'parts': ['المشروع', 'مراسلات']}
        results = await asyncio.gather(*[self.client.post('/api/v1/folders/import-path', headers=ha, json=body) for _ in range(2)])
        self.assertTrue(all(r.status_code == 200 for r in results), [r.text for r in results])
        first = results[0].json()['folder_id']
        self.assertEqual(results[1].json()['folder_id'], first)
        second = (await self.client.post('/api/v1/folders/import-path', headers=ha, json={**body, 'parts': ['المشروع', 'تقارير']})).json()['folder_id']
        d1, d2 = [await self.send(ha, 'same.txt', owner_id=b, folder_id=fid) for fid in (first, second)]
        self.assertNotEqual(d1['folder_id'], d2['folder_id'])
        self.assertEqual((await self.client.get('/api/v1/folders', headers=ha)).json(), [])
        folders = (await self.client.get('/api/v1/folders', headers=hb)).json()
        self.assertEqual({f['name'] for f in folders}, {'المشروع', 'مراسلات', 'تقارير'})
        self.assertTrue(all(f['owner_id'] == b for f in folders))
        self.assertEqual((await self.client.post('/api/v1/folders/import-path', headers=hc, json=body)).status_code, 403)
        for parts in (['..', 'escape'], ['/absolute'], ['a/b'], ['CON'], ['bad\\path'], ['']):
            response = await self.client.post('/api/v1/folders/import-path', headers=ha, json={**body, 'parts': parts})
            self.assertEqual(response.status_code, 422, response.text)
        response = await self.client.post('/api/v1/folders/import-path', headers=ha, json={'owner_id': a, 'parent_id': first, 'parts': ['bad']})
        self.assertEqual(response.status_code, 422)
        response = await self.client.patch(f"/api/v1/documents/{d1['id']}", headers=ha, json={'folder_id': (await self.client.post('/api/v1/folders', headers=ha, json={'name': 'own'})).json()['id']})
        self.assertEqual(response.status_code, 422)

    async def test_legacy_group_migration_idempotent_and_revocation_not_resurrected(self):
        from sqlalchemy import select, text
        from app.models.employee_link import EmployeeLinkGroup, EmployeeLinkMember
        from app.models.employee_relationship import EmployeeRelationship, LEGACY_MIGRATION
        (_, a), (_, b), (_, c) = await self.employees()
        async with self.Session() as db:
            group = EmployeeLinkGroup(name='old', created_by=self.admin.id)
            db.add(group); await db.flush()
            db.add_all([EmployeeLinkMember(group_id=group.id, user_id=uid) for uid in (self.people[0].id, self.people[1].id, self.people[2].id)])
            await db.commit()
            for statement in LEGACY_MIGRATION.split(';'):
                if statement.strip(): await db.execute(text(statement))
            await db.commit()
            rows = (await db.scalars(select(EmployeeRelationship).where(EmployeeRelationship.user_a_id.in_([u.id for u in self.people])))).all()
            self.assertEqual(len(rows), 3)
            self.assertTrue(all(r.mode == 'mutual' and r.access == 'read' for r in rows))
            victim_id = rows[0].id
            await db.delete(rows[0]); await db.commit()
            for statement in LEGACY_MIGRATION.split(';'):
                if statement.strip(): await db.execute(text(statement))
            await db.commit()
            self.assertIsNone(await db.get(EmployeeRelationship, victim_id))
            self.assertEqual(len((await db.scalars(select(EmployeeRelationship).where(EmployeeRelationship.user_a_id.in_([u.id for u in self.people])))).all()), 2)
