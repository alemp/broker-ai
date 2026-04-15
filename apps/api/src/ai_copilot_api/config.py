from functools import lru_cache
from pathlib import Path

from pydantic import Field, PostgresDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from ai_copilot_api.db.url import normalize_database_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = Field(default="development", validation_alias="APP_ENV")
    jwt_secret: str = Field(
        default="local-dev-only-jwt-secret-min-32-chars!",
        validation_alias="JWT_SECRET",
    )
    jwt_expire_hours: int = Field(default=24, validation_alias="JWT_EXPIRE_HOURS")
    cors_origins_raw: str = Field(
        default=(
            "http://localhost:5173,http://127.0.0.1:5173,"
            "http://localhost:8080,http://127.0.0.1:8080"
        ),
        validation_alias="CORS_ORIGINS",
    )
    default_organization_slug: str = Field(
        default="default",
        validation_alias="DEFAULT_ORGANIZATION_SLUG",
    )
    database_url: PostgresDsn = Field(
        default="postgresql+psycopg://ai_copilot:ai_copilot_dev@localhost:5432/ai_copilot",
        validation_alias="DATABASE_URL",
    )

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_postgres_scheme(cls, value: object) -> object:
        if isinstance(value, str):
            return normalize_database_url(value)
        return value
    storage_backend: str = Field(default="local", validation_alias="STORAGE_BACKEND")
    local_storage_path: Path = Field(
        default=Path(".local-storage/objects"),
        validation_alias="LOCAL_STORAGE_PATH",
    )
    aws_access_key_id: str | None = Field(
        default=None,
        validation_alias="AWS_ACCESS_KEY_ID",
    )
    aws_secret_access_key: str | None = Field(
        default=None,
        validation_alias="AWS_SECRET_ACCESS_KEY",
    )
    aws_region: str | None = Field(default=None, validation_alias="AWS_REGION")
    s3_bucket: str | None = Field(default=None, validation_alias="S3_BUCKET")
    aws_endpoint_url: str | None = Field(
        default=None,
        validation_alias="AWS_ENDPOINT_URL",
    )
    adequacy_refresh_interval_minutes: int = Field(
        default=0,
        validation_alias="ADEQUACY_REFRESH_INTERVAL_MINUTES",
        description="0 disables scheduled adequacy batch; otherwise interval in minutes (Phase 9).",
    )

    ocr_enabled: bool = Field(default=True, validation_alias="OCR_ENABLED")
    ocr_min_text_chars: int = Field(
        default=300,
        validation_alias="OCR_MIN_TEXT_CHARS",
        description="If extracted text is shorter than this, fallback to OCR.",
    )
    ocr_language: str = Field(
        default="por",
        validation_alias="OCR_LANGUAGE",
        description="Tesseract language code(s), e.g. 'por' or 'por+eng'.",
    )
    ocr_provider_url: str | None = Field(
        default=None,
        validation_alias="OCR_PROVIDER_URL",
        description="When set, OCR is performed by calling this HTTP endpoint.",
    )
    ocr_provider_timeout_seconds: int = Field(
        default=300,
        validation_alias="OCR_PROVIDER_TIMEOUT_SECONDS",
        description="HTTP timeout when calling OCR_PROVIDER_URL.",
    )
    ocr_provider_max_pages: int = Field(
        default=10,
        validation_alias="OCR_PROVIDER_MAX_PAGES",
        description="Max pages to OCR per document when using provider.",
    )
    ocr_provider_dpi: int = Field(
        default=150,
        validation_alias="OCR_PROVIDER_DPI",
        description="Render DPI hint passed to OCR provider.",
    )

    @field_validator("local_storage_path", mode="before")
    @classmethod
    def expand_path(cls, value: str | Path) -> Path:
        return Path(value).expanduser() if not isinstance(value, Path) else value

    @property
    def cors_origins(self) -> list[str]:
        parts = self.cors_origins_raw.split(",")
        return [p.strip() for p in parts if p.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
