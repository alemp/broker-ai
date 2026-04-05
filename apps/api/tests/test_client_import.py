from __future__ import annotations

import io
import os
import uuid

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL is required for client import integration tests",
)


def _register(client: TestClient) -> str:
    email = f"import-{uuid.uuid4().hex}@example.com"
    password = "longpassword123"
    reg = client.post(
        "/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Import Tester"},
    )
    assert reg.status_code == 200, reg.text
    return reg.json()["access_token"]


def test_client_import_preview_and_commit_csv(client: TestClient) -> None:
    token = _register(client)
    headers = {"Authorization": f"Bearer {token}"}

    uid = uuid.uuid4().hex
    ext1 = f"EXT-IMP-{uid}-1"
    ext2 = f"EXT-IMP-{uid}-2"
    held = '"Auto|Porto|ACTIVE|2024-01-01|"'
    csv_body = (
        "full_name,email,external_id,lob_codes,held_products\n"
        f"Import One,import-one-{uid}@example.com,{ext1},MOTOR,{held}\n"
        f"Import Two,import-two-{uid}@example.com,{ext2},LIFE,\n"
    )

    prev = client.post(
        "/v1/clients/import/preview",
        headers=headers,
        files={"file": ("clients.csv", io.BytesIO(csv_body.encode("utf-8")), "text/csv")},
    )
    assert prev.status_code == 200, prev.text
    body = prev.json()
    assert body["source_format"] == "csv"
    assert body["total_data_rows"] == 2
    assert body["valid_row_count"] == 2
    assert body["error_count"] == 0
    assert len(body["preview_rows"]) == 2
    assert body["preview_rows"][0]["held_product_count"] == 1

    commit = client.post(
        "/v1/clients/import/commit",
        headers=headers,
        files={"file": ("clients.csv", io.BytesIO(csv_body.encode("utf-8")), "text/csv")},
    )
    assert commit.status_code == 200, commit.text
    cj = commit.json()
    assert cj["row_count"] == 2
    assert cj["inserted_count"] == 2
    assert cj["updated_count"] == 0

    cid = None
    lst = client.get("/v1/clients", headers=headers)
    for row in lst.json():
        if row.get("external_id") == ext1:
            cid = row["id"]
            break
    assert cid is not None

    detail = client.get(f"/v1/clients/{cid}", headers=headers)
    assert detail.status_code == 200
    d = detail.json()
    assert len(d["lines_of_business"]) >= 1
    assert len(d["held_products"]) >= 1
    assert d["held_products"][0]["ingestion_source"] == "csv_import"

    commit2 = client.post(
        "/v1/clients/import/commit",
        headers=headers,
        files={"file": ("clients.csv", io.BytesIO(csv_body.encode("utf-8")), "text/csv")},
    )
    assert commit2.status_code == 200, commit2.text
    assert commit2.json()["inserted_count"] == 0
    assert commit2.json()["updated_count"] == 2


def test_client_import_preview_portuguese_headers_csv(client: TestClient) -> None:
    token = _register(client)
    headers = {"Authorization": f"Bearer {token}"}
    uid = uuid.uuid4().hex
    ext1 = f"EXT-PT-{uid}"
    csv_body = (
        "Nome completo,Correio eletrónico,ID externo\n"
        f"Cliente PT,cliente-pt-{uid}@example.com,{ext1}\n"
    )
    prev = client.post(
        "/v1/clients/import/preview",
        headers=headers,
        files={"file": ("pt.csv", io.BytesIO(csv_body.encode("utf-8")), "text/csv")},
    )
    assert prev.status_code == 200, prev.text
    body = prev.json()
    assert body["total_data_rows"] == 1
    assert body["valid_row_count"] == 1
    assert body["error_count"] == 0


def test_client_import_rejects_unknown_lob(client: TestClient) -> None:
    token = _register(client)
    headers = {"Authorization": f"Bearer {token}"}
    csv_body = (
        "full_name,email,lob_codes\n"
        f"Bad Lob,bad-lob-{uuid.uuid4().hex}@example.com,NOT_A_REAL_LOB_CODE\n"
    )
    prev = client.post(
        "/v1/clients/import/preview",
        headers=headers,
        files={"file": ("bad.csv", io.BytesIO(csv_body.encode("utf-8")), "text/csv")},
    )
    assert prev.status_code == 200
    assert prev.json()["error_count"] >= 1
    assert prev.json()["valid_row_count"] == 0
