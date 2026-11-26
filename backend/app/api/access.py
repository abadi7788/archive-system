import uuid
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.folder import Folder, FolderGrant
from app.models.user import User, UserRole


async def linked_permissions(user: User, db: AsyncSession) -> dict[uuid.UUID, str]:
    from app.models.employee_relationship import EmployeeRelationship as R
    # AsyncSession is request-scoped: reuse direct-pair permissions within this request only.
    cache = db.info.setdefault('employee_relationship_permissions', {})
    if user.id in cache: return cache[user.id]
    rows = (await db.scalars(select(R).where(or_(R.user_a_id == user.id,
        and_(R.user_b_id == user.id, R.mode == 'mutual'))))).all()
    cache[user.id] = {r.user_b_id if r.user_a_id == user.id else r.user_a_id: r.access for r in rows}
    return cache[user.id]


async def can_manage_owner(user: User, owner_id: uuid.UUID, db: AsyncSession) -> bool:
    if user.role == UserRole.VIEWER: return False
    if user.id == owner_id or user.role == UserRole.ADMIN: return True
    return (await linked_permissions(user, db)).get(owner_id) == 'full'


async def get_visible_owner_ids(user: User, db: AsyncSession) -> set[uuid.UUID] | None:
    if user.role == UserRole.ADMIN: return None
    return {user.id, *(await linked_permissions(user, db)).keys()}


async def workspace_owner(user: User, db: AsyncSession, owner_id=None):
    """Lists/searches are personal by default; another owner must be selected explicitly."""
    owner_id = owner_id or user.id
    visible = await get_visible_owner_ids(user, db)
    if visible is not None and owner_id not in visible:
        from fastapi import HTTPException
        raise HTTPException(403, 'Access to this workspace is not allowed')
    return owner_id


async def build_document_visibility_clause(user: User, db: AsyncSession, include_deleted: bool = False):
    """Build SQLAlchemy WHERE clause enforcing data isolation + linked employee visibility + active filter."""
    clauses = []
    if not include_deleted:
        clauses.append(Document.deleted_at.is_(None))
    visible_owners = await get_visible_owner_ids(user, db)
    if visible_owners is not None:
        shared_folders = select(FolderGrant.folder_id).where(FolderGrant.user_id == user.id)
        clauses.append(
            or_(
                Document.user_id.in_(visible_owners),
                Document.folder_id.in_(shared_folders),
            )
        )
    return and_(*clauses) if clauses else True


async def build_folder_visibility_clause(user: User, db: AsyncSession, include_deleted: bool = False):
    """Build SQLAlchemy WHERE clause for folders enforcing isolation + linked employee visibility + active filter."""
    clauses = []
    if not include_deleted:
        clauses.append(Folder.deleted_at.is_(None))
    visible_owners = await get_visible_owner_ids(user, db)
    if visible_owners is not None:
        shared_folders = select(FolderGrant.folder_id).where(FolderGrant.user_id == user.id)
        clauses.append(
            or_(
                Folder.owner_id.in_(visible_owners),
                Folder.id.in_(shared_folders),
            )
        )
    return and_(*clauses) if clauses else True


async def build_user_display_map(db: AsyncSession, user_ids: set[uuid.UUID]) -> dict[uuid.UUID, dict]:
    """Fetch display metadata (full_name, job_title, username) for a set of user IDs."""
    clean_ids = {uid for uid in user_ids if uid is not None}
    if not clean_ids:
        return {}
    rows = (
        await db.execute(
            select(User.id, User.username, User.full_name, User.job_title, User.department, User.role).where(
                User.id.in_(clean_ids)
            )
        )
    ).all()
    result: dict[uuid.UUID, dict] = {}
    for row in rows:
        display_name = (row.full_name or "").strip() or row.username
        result[row.id] = {
            "id": str(row.id),
            "username": row.username,
            "full_name": row.full_name,
            "job_title": row.job_title,
            "department": row.department,
            "role": row.role.value if hasattr(row.role, "value") else str(row.role),
            "display_name": display_name,
        }
    return result
