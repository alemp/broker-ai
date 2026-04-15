from typing import Protocol, runtime_checkable


@runtime_checkable
class ObjectStorage(Protocol):
    """Blob storage abstraction: local filesystem (dev) or S3 (deployed)."""

    def put_object(self, key: str, data: bytes, content_type: str | None = None) -> str:
        """Persist bytes under `key`. Returns the storage key used."""
        ...

    def get_object(self, key: str) -> bytes:
        """Read object by key."""
        ...

    def exists_object(self, key: str) -> bool:
        """Return True if object exists for `key`."""
        ...
