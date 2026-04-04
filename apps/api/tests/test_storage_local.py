from pathlib import Path

from ai_copilot_api.storage.local import LocalObjectStorage


def test_local_storage_put_get_roundtrip(tmp_path: Path) -> None:
    storage = LocalObjectStorage(tmp_path / "objects")
    key = "org/test/hello.txt"
    payload = b"phase-0"
    assert storage.put_object(key, payload, content_type="text/plain") == key
    assert storage.get_object(key) == payload
