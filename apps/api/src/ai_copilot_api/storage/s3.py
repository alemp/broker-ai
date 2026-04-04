import boto3
from botocore.client import BaseClient


class S3ObjectStorage:
    """Amazon S3 (or S3-compatible) storage."""

    def __init__(
        self,
        bucket: str,
        *,
        region: str | None = None,
        endpoint_url: str | None = None,
        access_key_id: str | None = None,
        secret_access_key: str | None = None,
    ) -> None:
        self._bucket = bucket
        session_kw: dict[str, str] = {}
        if access_key_id and secret_access_key:
            session_kw["aws_access_key_id"] = access_key_id
            session_kw["aws_secret_access_key"] = secret_access_key
        self._client: BaseClient = boto3.client(
            "s3",
            region_name=region,
            endpoint_url=endpoint_url,
            **session_kw,
        )

    def put_object(self, key: str, data: bytes, content_type: str | None = None) -> str:
        extra: dict[str, str] = {}
        if content_type:
            extra["ContentType"] = content_type
        self._client.put_object(Bucket=self._bucket, Key=key, Body=data, **extra)
        return key

    def get_object(self, key: str) -> bytes:
        response = self._client.get_object(Bucket=self._bucket, Key=key)
        body = response["Body"]
        return body.read()
