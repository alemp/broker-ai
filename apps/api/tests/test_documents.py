from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL is required for documents integration tests",
)


def _unique_email() -> str:
    return f"docs-{uuid.uuid4().hex}@example.com"


def _minimal_pdf_bytes() -> bytes:
    # Minimal-ish PDF header/footer for magic-bytes validation.
    return b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"


def test_upload_and_download_pdf_document(client: TestClient) -> None:
    email = _unique_email()
    password = "longpassword123"
    reg = client.post("/v1/auth/register", json={"email": email, "password": password})
    assert reg.status_code == 200, reg.text
    token = reg.json()["access_token"]

    up = client.post(
        "/v1/documents",
        headers={"Authorization": f"Bearer {token}"},
        data={"document_type": "GENERAL_CONDITIONS"},
        files={"file": ("conditions.pdf", _minimal_pdf_bytes(), "application/pdf")},
    )
    assert up.status_code == 201, up.text
    body = up.json()
    assert body["document_type"] == "GENERAL_CONDITIONS"
    assert body["original_filename"] == "conditions.pdf"
    assert body["sha256"]

    doc_id = body["id"]
    dl = client.get(
        f"/v1/documents/{doc_id}/download",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert dl.status_code == 200
    assert dl.content.startswith(b"%PDF-")


def test_upload_rejects_non_pdf(client: TestClient) -> None:
    email = _unique_email()
    password = "longpassword123"
    reg = client.post("/v1/auth/register", json={"email": email, "password": password})
    assert reg.status_code == 200
    token = reg.json()["access_token"]

    up = client.post(
        "/v1/documents",
        headers={"Authorization": f"Bearer {token}"},
        data={"document_type": "GENERAL_CONDITIONS"},
        files={"file": ("not.pdf", b"hello", "application/octet-stream")},
    )
    assert up.status_code == 400

