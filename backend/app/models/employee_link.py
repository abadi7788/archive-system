import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, MetadataMixin, UUIDPrimaryKey


class EmployeeLinkGroup(UUIDPrimaryKey, MetadataMixin, Base):
    __tablename__ = "employee_link_groups"

    name: Mapped[str] = mapped_column(String(180), nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class EmployeeLinkMember(UUIDPrimaryKey, Base):
    __tablename__ = "employee_link_members"
    __table_args__ = (UniqueConstraint("group_id", "user_id", name="uq_employee_link_group_user"),)

    group_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("employee_link_groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
