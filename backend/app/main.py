from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import api_router
from app.core.config import settings


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Initial bootstrap and automatic startup schema migration for existing PostgreSQL databases.
    from sqlalchemy import select, text
    from app.db import SessionLocal, engine
    from app.models import Base, User, UserRole
    from app.core.security import hash_password
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("ALTER TABLE gemini_usage ADD COLUMN IF NOT EXISTS retry_after TIMESTAMPTZ"))
        await conn.execute(text("ALTER TABLE gemini_usage ADD COLUMN IF NOT EXISTS last_error_code VARCHAR(48)"))
        await conn.execute(text("ALTER TABLE gemini_usage ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ"))
        # Old releases treated any 429 as an all-day ban. Recover those flags once;
        # genuine daily-provider bans created by this release carry a reason code.
        await conn.execute(text("UPDATE gemini_usage SET quota_exhausted = FALSE, retry_after = NOW() + INTERVAL '60 seconds', last_error_code = 'rate_limited' WHERE quota_exhausted = TRUE AND last_error_code IS NULL"))
        # Ensure new columns exist on pre-existing deployments without manual intervention.
        await conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS extracted_text TEXT"))
        await conn.execute(text("ALTER TABLE documents ALTER COLUMN file_size TYPE BIGINT"))
        await conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ"))
        await conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL"))
        await conn.execute(text("ALTER TABLE folders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"))
        await conn.execute(text("ALTER TABLE folders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ"))
        await conn.execute(text("ALTER TABLE folders ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS can_print BOOLEAN NOT NULL DEFAULT FALSE"))
        await conn.execute(text("UPDATE users SET can_print = TRUE WHERE role = 'admin'"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(160)"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR(160)"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(16)"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_theme VARCHAR(16) NOT NULL DEFAULT 'light'"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_item_size INTEGER NOT NULL DEFAULT 160"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE"))
        from app.models.employee_relationship import LEGACY_MIGRATION
        for statement in LEGACY_MIGRATION.split(';'):
            if statement.strip(): await conn.execute(text(statement))
    # Ensure local document storage directory is initialized on startup.
    from app.services.storage_service import get_storage
    await get_storage().ping()
    if settings.bootstrap_admin_username and settings.bootstrap_admin_password:
        from argon2 import PasswordHasher
        from app.core.security import verify_password
        from app.models.audit_log import AuditLog

        async with SessionLocal() as session:
            bootstrap_password = settings.bootstrap_admin_password.get_secret_value()
            existing_admin = await session.scalar(
                select(User).where(User.username == settings.bootstrap_admin_username)
            )
            if not existing_admin:
                try:
                    password_hash = hash_password(bootstrap_password)
                except ValueError:
                    # Allow any bootstrap password from .env on initial creation and force immediate replacement on first login.
                    password_hash = PasswordHasher().hash(bootstrap_password)
                session.add(
                    User(
                        username=settings.bootstrap_admin_username,
                        password_hash=password_hash,
                        role=UserRole.ADMIN,
                        must_change_password=True,
                        can_print=True,
                    )
                )
                await session.commit()
            elif not existing_admin.must_change_password and verify_password(
                bootstrap_password, existing_admin.password_hash
            ):
                changed_before = await session.scalar(
                    select(AuditLog.id).where(
                        AuditLog.actor_id == existing_admin.id,
                        AuditLog.action == "user.password_changed",
                    )
                )
                if not changed_before:
                    existing_admin.must_change_password = True
                    await session.commit()
    import asyncio
    from app.services.ocr_retry import retry_queued_documents
    retry_task = asyncio.create_task(retry_queued_documents())
    try:
        yield
    finally:
        retry_task.cancel()
        try:
            await retry_task
        except asyncio.CancelledError:
            pass
        await engine.dispose()


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan, docs_url="/docs" if settings.environment != "production" else None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://frontend:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Admin-Step-Up", "Accept-Language"],
)
app.include_router(api_router, prefix="/api/v1")


@app.middleware("http")
async def security_and_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


@app.get("/health", include_in_schema=False)
@app.get("/api/v1/health", include_in_schema=False)
async def health():
    return JSONResponse({"status": "ok", "revision": settings.app_revision}, headers={"Cache-Control": "no-store"})


@app.middleware("http")
async def complete_request_audit(request: Request, call_next):
    from app.services.audit_context import request_audit, peer_ip
    from app.models.audit_log import AuditLog
    from app.db import SessionLocal
    context = {"ip": peer_ip(request), "user_agent": (request.headers.get("user-agent") or "")[:512], "recorded": False}
    marker = request_audit.set(context)
    try:
        response = await call_next(request)
        # Existing domain events remain authoritative. Cover previously unaudited writes,
        # including preferences/settings/grants, but never serialize request bodies.
        if request.method in {"POST", "PUT", "PATCH", "DELETE"} and response.status_code < 400 and context.get("actor_id") and not context['recorded'] and not request.url.path.startswith('/api/v1/uploads'):
            async with SessionLocal() as db:
                route = request.scope.get('route')
                template = getattr(route, 'path', request.url.path)
                db.add(AuditLog(actor_id=context['actor_id'], action='request.' + request.method.lower(),
                    resource_type=template.split('/')[3] if len(template.split('/')) > 3 else 'system',
                    detail={"route": template, "method": request.method, "changes": context.get('changes', []), "parameters": {k: str(v) for k, v in request.path_params.items() if 'token' not in k}}))
                await db.commit()
        return response
    finally:
        request_audit.reset(marker)


# FastAPI's default validation errors may echo rejected passwords/API keys in
# `input` or nested context. Return only the safe fields used by the UI.
from fastapi.exceptions import RequestValidationError


@app.exception_handler(RequestValidationError)
async def safe_validation_error(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"detail": [
        {"loc": list(error['loc']), "msg": error['msg'], "type": error['type']}
        for error in exc.errors()
    ]})
