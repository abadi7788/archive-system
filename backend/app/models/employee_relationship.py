"""Independent pairwise relationships. No group membership or graph traversal grants access."""
import uuid
from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, CreatedAtMixin, MetadataMixin, UUIDPrimaryKey


class EmployeeRelationship(UUIDPrimaryKey, CreatedAtMixin, MetadataMixin, Base):
    __tablename__ = 'employee_relationships'
    __table_args__ = (
        CheckConstraint("mode IN ('mutual', 'supervisory')"),
        CheckConstraint("access IN ('read', 'full')"),
        CheckConstraint('user_a_id <> user_b_id'),
    )
    # user_a is the supervisor for a supervisory relationship.
    user_a_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    user_b_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    pair_key: Mapped[str] = mapped_column(String(73), unique=True)
    mode: Mapped[str] = mapped_column(String(16), default='mutual')
    access: Mapped[str] = mapped_column(String(8), default='read')
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'), nullable=True)


# Convert each old group's directly shared pairs once, then retire old membership.
# Clearing legacy groups makes restarting idempotent, including after a pair is revoked.
LEGACY_MIGRATION = """
INSERT INTO employee_relationships (id, user_a_id, user_b_id, pair_key, mode, access, created_by)
SELECT gen_random_uuid(), a.user_id, b.user_id, a.user_id::text || ':' || b.user_id::text,
       'mutual', 'read', MIN(g.created_by::text)::uuid
FROM employee_link_members a
JOIN employee_link_members b ON a.group_id = b.group_id AND a.user_id < b.user_id
JOIN employee_link_groups g ON g.id = a.group_id
GROUP BY a.user_id, b.user_id
ON CONFLICT (pair_key) DO NOTHING;
DELETE FROM employee_link_members;
DELETE FROM employee_link_groups;
"""
