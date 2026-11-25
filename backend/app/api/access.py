import uuid
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.employee_link import EmployeeLinkMember
from app.models.folder import Folder, FolderGrant
from app.models.user import User, UserRole


async def get_visible_owner_ids(user: User, db: AsyncSession) -> set[uuid.UUID] | None:
    """
    Returns None for Admin (unrestricted visibility across all employees).
    For non-admin users, returns {user.id} union all employee IDs that share
    at least one EmployeeLinkGroup with the user.
    """
    if user.role == UserRole.ADMIN:
        return None
    group_ids_q = select(EmployeeLinkMember.group_id).where(EmployeeLinkMember.user_id == user.id)
    peer_ids = (
        await db.scalars(
            select(EmployeeLinkMember.user_id).where(EmployeeLinkMember.group_id.in_(group_ids_q)).distinct()
        )
    ).all()
    visible = {user.id}
    visible.update(peer_ids)
    return visible


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
