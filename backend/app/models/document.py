import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Computed, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, MetadataMixin, UUIDPrimaryKey


class Document(UUIDPrimaryKey, MetadataMixin, Base):
    __tablename__ = "documents"
    __table_args__ = (
        Index("ix_documents_extracted_text_fts", "search_vector", postgresql_using="gin"),
        Index("ix_documents_user_created", "user_id", "created_at"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    folder_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("folders.id", ondelete="SET NULL"), nullable=True, index=True)
    department: Mapped[Optional[str]] = mapped_column(String(160), nullable=True, index=True)
    classification: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, index=True)
    keywords: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    file_name: Mapped[str] = mapped_column(String(512), nullable=False)
    file_path: Mapped[str] = mapped_column(String(2048), nullable=False, unique=True)
    mime_type: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    extracted_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    search_vector: Mapped[Optional[str]] = mapped_column(
        TSVECTOR,
        Computed("to_tsvector('simple', coalesce(extracted_text, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(metadata ->> 'keywords', ''))", persisted=True),
        nullable=True,
    )
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    processed_by_key: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    processing_status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued", server_default="queued")
    processing_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    deleted_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
