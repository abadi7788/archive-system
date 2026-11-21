import uuid
from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, MetadataMixin, UUIDPrimaryKey

class Folder(UUIDPrimaryKey, MetadataMixin, Base):
    __tablename__ = "folders"
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("folders.id", ondelete="CASCADE"), nullable=True, index=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    path: Mapped[str] = mapped_column(String(1024), nullable=False, default="/")

class FolderGrant(UUIDPrimaryKey, MetadataMixin, Base):
    __tablename__ = "folder_grants"
    __table_args__ = (UniqueConstraint("folder_id", "user_id", name="uq_folder_user_grant"),)
    folder_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("folders.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    permission: Mapped[str] = mapped_column(String(16), nullable=False, default="read")
