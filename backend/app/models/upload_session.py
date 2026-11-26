import uuid
from datetime import datetime
from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, UUIDPrimaryKey


class UploadSession(UUIDPrimaryKey, Base):
    __tablename__ = 'upload_sessions'
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    file_name: Mapped[str] = mapped_column(String(250))
    file_size: Mapped[int] = mapped_column(BigInteger)
    received: Mapped[int] = mapped_column(BigInteger, default=0)
    stored_bytes: Mapped[int] = mapped_column(BigInteger, default=24)
    chunks: Mapped[int] = mapped_column(Integer, default=0)
    last_digest: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_offset: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    options: Mapped[dict] = mapped_column(JSONB, default=dict)
    document_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey('documents.id', ondelete='SET NULL'), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
