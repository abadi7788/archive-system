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
        # Ensure new columns exist on pre-existing deployments without manual intervention.
        await conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS extracted_text TEXT"))
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
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE"))
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
    yield
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
    return JSONResponse({"status": "ok"}, headers={"Cache-Control": "no-store"})
