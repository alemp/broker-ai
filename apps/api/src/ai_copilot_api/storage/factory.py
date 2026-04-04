from ai_copilot_api.config import Settings
from ai_copilot_api.storage.base import ObjectStorage
from ai_copilot_api.storage.local import LocalObjectStorage
from ai_copilot_api.storage.s3 import S3ObjectStorage


def get_object_storage(settings: Settings) -> ObjectStorage:
    backend = settings.storage_backend.lower().strip()
    if backend == "local":
        return LocalObjectStorage(settings.local_storage_path)
    if backend == "s3":
        if not settings.s3_bucket:
            msg = "S3_BUCKET is required when STORAGE_BACKEND=s3"
            raise ValueError(msg)
        return S3ObjectStorage(
            settings.s3_bucket,
            region=settings.aws_region,
            endpoint_url=settings.aws_endpoint_url,
            access_key_id=settings.aws_access_key_id,
            secret_access_key=settings.aws_secret_access_key,
        )
    msg = f"Unknown STORAGE_BACKEND: {settings.storage_backend!r}"
    raise ValueError(msg)
