from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from the environment or a .env file."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Archive YemanY"
    environment: str = "development"
    database_url: str | None = None
    bootstrap_admin_username: str | None = None
    bootstrap_admin_password: SecretStr | None = None

    gemini_api_key: SecretStr | None = None
    system_gemini_key_1: SecretStr | None = None
    system_gemini_key_2: SecretStr | None = None
    system_gemini_key_3: SecretStr | None = None
    gemini_model: str = "gemini-2.5-flash"
    gemini_timeout_seconds: float = 90.0
    ocr_retry_interval_seconds: int = Field(default=120, ge=5, le=3600)
    ocr_retry_batch_size: int = Field(default=20, ge=1, le=200)

    master_encryption_key: SecretStr
    master_admin_password: SecretStr
    jwt_secret_key: SecretStr
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = Field(default=480, ge=1, le=10080)

    postgres_user: str = "archive_admin"
    postgres_password: SecretStr = SecretStr("secure_local_password")
    postgres_db: str = "archive_system_db"
    postgres_host: str = "postgres"
    postgres_port: int = Field(default=5432, ge=1, le=65535)

    # Limits processing only, never upload/storage. Large originals remain downloadable.
    extraction_max_bytes: int = Field(default=20 * 1024 * 1024, ge=1024)
    upload_session_hours: int = Field(default=24, ge=1)
    storage_provider: str = "local"
    s3_endpoint_url: str = "http://minio:9000"
    s3_bucket_name: str = "archive-documents"
    s3_access_key: SecretStr = SecretStr("minioadmin")
    s3_secret_key: SecretStr = SecretStr("minioadmin")
    s3_region: str = "us-east-1"

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password.get_secret_value()}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def system_gemini_keys(self) -> tuple[str, ...]:
        seen: set[str] = set()
        ordered: list[str] = []
        for value in (
            self.gemini_api_key,
            self.system_gemini_key_1,
            self.system_gemini_key_2,
            self.system_gemini_key_3,
        ):
            if not value:
                continue
            cleaned = value.get_secret_value().strip()
            if cleaned and cleaned not in seen:
                seen.add(cleaned)
                ordered.append(cleaned)
        return tuple(ordered)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
