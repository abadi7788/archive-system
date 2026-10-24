from sqlalchemy import Boolean, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, MetadataMixin, UUIDPrimaryKey


class SystemAPIKey(UUIDPrimaryKey, MetadataMixin, Base):
    __tablename__ = "system_api_keys"
    __table_args__ = (UniqueConstraint("priority", name="uq_system_api_keys_priority"),)

    label: Mapped[str] = mapped_column(String(120), nullable=False)
    key_encrypted: Mapped[str] = mapped_column(String(2048), nullable=False)
    priority: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
