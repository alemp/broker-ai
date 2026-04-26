from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL is required for extraction integration tests",
)


def _unique_email() -> str:
    return f"extract-{uuid.uuid4().hex}@example.com"


def _minimal_pdf_bytes() -> bytes:
    return (
        b"%PDF-1.4\n"
        b"1 0 obj\n<<>>\nendobj\n"
        b"2 0 obj\n<< /Length 44 >>\nstream\n"
        b"BT /F1 12 Tf 72 720 Td (Coberturas:) Tj ET\n"
        b"endstream\nendobj\n"
        b"trailer\n<<>>\n%%EOF\n"
    )


def test_extract_creates_run_and_normalizes(client: TestClient) -> None:
    email = _unique_email()
    password = "longpassword123"
    reg = client.post("/v1/auth/register", json={"email": email, "password": password})
    assert reg.status_code == 200, reg.text
    token = reg.json()["access_token"]

    # Create one taxonomy entry to normalize against.
    code = f"AUTO_THEFT_{uuid.uuid4().hex[:8].upper()}"
    tax = client.post(
        "/v1/coverage-taxonomy",
        headers={"Authorization": f"Bearer {token}"},
        json={"code": code, "label": "Roubo e furto", "synonyms": ["furto", "roubo"]},
    )
    assert tax.status_code in (200, 201), tax.text

    up = client.post(
        "/v1/documents",
        headers={"Authorization": f"Bearer {token}"},
        data={"document_type": "GENERAL_CONDITIONS"},
        files={"file": ("conditions.pdf", _minimal_pdf_bytes(), "application/pdf")},
    )
    assert up.status_code == 201, up.text
    doc_id = up.json()["id"]

    ex = client.post(
        f"/v1/documents/{doc_id}/extract",
        headers={"Authorization": f"Bearer {token}"},
    )
    # Extraction is async (background job) — API returns 202 with job meta.
    assert ex.status_code == 202, ex.text
    body = ex.json()
    assert body["job_type"] == "document_extraction"
    assert body["status"] == "RUNNING"
    assert (body.get("job_meta") or {}).get("document_id") == doc_id

