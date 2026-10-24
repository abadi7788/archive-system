from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import api_router
from app.core.config import settings


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Initial bootstrap convenience. Production schema changes should use Alembic migrations.
    from sqlalchemy import select
    from app.db import SessionLocal, engine
    from app.models import Base, User, UserRole
    from app.core.security import hash_password
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    if settings.bootstrap_admin_username and settings.bootstrap_admin_password:
        async with SessionLocal() as session:
            exists = await session.scalar(select(User.id).where(User.username == settings.bootstrap_admin_username))
            if not exists:
                session.add(User(username=settings.bootstrap_admin_username, password_hash=hash_password(settings.bootstrap_admin_password.get_secret_value()), role=UserRole.ADMIN))
                await session.commit()
    yield
    await engine.dispose()


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan, docs_url="/docs" if settings.environment != "production" else None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://frontend:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Admin-Step-Up"],
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
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


@app.get("/health", include_in_schema=False)
async def health():
    return JSONResponse({"status": "ok"}, headers={"Cache-Control": "no-store"})
