from functools import lru_cache
from pathlib import Path

from pydantic import Field, PostgresDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = Field(default="development", validation_alias="APP_ENV")
    database_url: PostgresDsn = Field(
        default="postgresql+psycopg://ai_copilot:ai_copilot_dev@localhost:5432/ai_copilot",
        validation_alias="DATABASE_URL",
    )
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

    @field_validator("local_storage_path", mode="before")
    @classmethod
    def expand_path(cls, value: str | Path) -> Path:
        return Path(value).expanduser() if not isinstance(value, Path) else value


@lru_cache
def get_settings() -> Settings:
    return Settings()
