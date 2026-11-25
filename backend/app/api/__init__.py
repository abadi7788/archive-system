from fastapi import APIRouter

from app.api import admin, audit, auth, dashboard, documents, document_tools, exports, folders, search, taxonomy, trash, users

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(document_tools.router, tags=["document-tools"])
api_router.include_router(exports.router, prefix="/exports", tags=["exports"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(taxonomy.router, prefix="/taxonomy", tags=["taxonomy"])
api_router.include_router(trash.router, prefix="/trash", tags=["trash"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(audit.router, prefix="/audit", tags=["audit"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(folders.router, prefix="/folders", tags=["folders"])
