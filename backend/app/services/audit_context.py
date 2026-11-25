"""Enrich every existing transactional audit event without storing request bodies/secrets."""
from contextvars import ContextVar
from ipaddress import ip_address
from sqlalchemy import event, inspect
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog

request_audit: ContextVar[dict | None] = ContextVar('request_audit', default=None)


def peer_ip(request):
    # Never trust client-supplied X-Forwarded-For. Configure uvicorn trusted proxies at deployment.
    try:
        return str(ip_address(request.client.host)) if request.client else None
    except ValueError:
        return None


@event.listens_for(Session, 'before_flush')
def enrich_audit(session, flush_context, instances):
    context = request_audit.get()
    if not context:
        return
    # Capture only explicitly safe metadata. Secrets, OCR contents and credentials
    # never enter the log, even when new models/fields are added later.
    allowed = {'username', 'full_name', 'job_title', 'role', 'department', 'is_active', 'can_print',
               'must_change_password', 'preferred_language', 'preferred_theme', 'file_name',
               'folder_id', 'classification', 'name', 'parent_id', 'priority', 'label'}
    changes = context.setdefault('changes', [])
    seen = context.setdefault('seen_objects', set())
    for obj in list(session.new) + list(session.dirty) + list(session.deleted):
        table = getattr(obj, '__tablename__', '')
        if table not in {'users', 'documents', 'folders', 'system_api_keys'} or id(obj) in seen:
            continue
        state = inspect(obj)
        fields = {}
        for attr in state.attrs:
            if not attr.history.has_changes():
                continue
            if attr.key in {'password_hash', 'gemini_key_encrypted', 'key_encrypted'}:
                fields[attr.key.replace('_encrypted', '').replace('_hash', '') + '_changed'] = True
            elif attr.key in allowed:
                def safe(value):
                    return value.value if hasattr(value, 'value') else str(value)[:512] if value is not None else None
                fields[attr.key] = {'before': safe(attr.history.deleted[0]) if attr.history.deleted else None,
                                    'after': safe(attr.history.added[0]) if attr.history.added else None}
        if fields and len(changes) < 100:
            changes.append({'resource': table, 'fields': fields})
            seen.add(id(obj))
    for item in list(session.new):
        if not isinstance(item, AuditLog):
            continue
        item.ip_address = context.get('ip')
        item.user_agent = context.get('user_agent')
        detail = dict(item.detail or {})
        if context.get('actor_name'):
            detail['actor_name'] = context['actor_name']
        if changes:
            detail['changes'] = list(changes)
        item.detail = detail
        context['recorded'] = True
