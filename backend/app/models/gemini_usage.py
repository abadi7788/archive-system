from datetime import date

from sqlalchemy import Boolean, Date, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class GeminiUsage(Base):
    """Shared, transaction-locked counters; fingerprints never expose credentials."""
    __tablename__ = "gemini_usage"

    fingerprint: Mapped[str] = mapped_column(String(64), primary_key=True)
    usage_day: Mapped[date] = mapped_column(Date, nullable=False)
    requests_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    daily_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=1500, server_default="1500")
    quota_exhausted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    provider_disabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
