import enum
from typing import Optional

from sqlalchemy import Boolean, Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, MetadataMixin, UUIDPrimaryKey


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    ARCHIVER = "archiver"
    VIEWER = "viewer"
    EMPLOYEE = "employee"  # Backwards-compatible legacy role


class User(UUIDPrimaryKey, MetadataMixin, Base):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role", values_callable=lambda values: [v.value for v in values]), nullable=False, default=UserRole.ARCHIVER)
    department: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    gemini_key_encrypted: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    must_change_password: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
