from pathlib import Path


class LocalObjectStorage:
    """Filesystem-backed storage under a root directory (gitignored in development)."""

    def __init__(self, root: Path) -> None:
        self._root = root.resolve()
        self._root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        safe = key.lstrip("/").replace("..", "")
        path = (self._root / safe).resolve()
        if not str(path).startswith(str(self._root)):
            msg = "Invalid object key"
            raise ValueError(msg)
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    def put_object(self, key: str, data: bytes, content_type: str | None = None) -> str:
        _ = content_type
        path = self._path(key)
        path.write_bytes(data)
        return key

    def get_object(self, key: str) -> bytes:
        path = self._path(key)
        return path.read_bytes()
