from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ai_copilot_api.api.deps import get_current_user
from ai_copilot_api.db.enums import IngestionSource
from ai_copilot_api.db.models import User
from ai_copilot_api.db.session import get_db
from ai_copilot_api.domain.client_import import (
    _PREVIEW_ROWS,
    ImportValidationResult,
    RawImportRow,
    apply_import,
    detect_format,
    parse_spreadsheet,
    read_upload_limited,
    sha256_hex,
    validate_rows_structural,
    validate_rows_with_catalog,
)
from ai_copilot_api.schemas.crm import (
    ClientImportCommitOut,
    ClientImportPreviewOut,
    ClientImportRowErrorOut,
)

router = APIRouter(prefix="/clients/import", tags=["clients-import"])


def _run_validation(
    db: Session,
    org_id: uuid.UUID,
    content: bytes,
    filename: str | None,
) -> tuple[str, str, list[RawImportRow], ImportValidationResult]:
    limited, err = read_upload_limited(content)
    if err or limited is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err or "Nenhuma planilha enviada.",
        )
    fmt = detect_format(filename, limited)
    digest = sha256_hex(limited)
    raw_rows, parse_err = parse_spreadsheet(limited, fmt)
    if parse_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=parse_err)
    structural = validate_rows_structural(raw_rows)
    final = validate_rows_with_catalog(db, org_id, structural)
    return fmt, digest, raw_rows, final


@router.post("/preview", response_model=ClientImportPreviewOut)
async def preview_client_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientImportPreviewOut:
    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhuma planilha enviada.",
        )

    fmt, digest, raw_rows, final = _run_validation(
        db,
        current_user.organization_id,
        content,
        file.filename,
    )

    preview_rows: list[dict] = []
    for row in final.rows[:_PREVIEW_ROWS]:
        preview_rows.append(
            {
                "row_number": row.row_number,
                "full_name": row.full_name,
                "email": row.email,
                "external_id": row.external_id,
                "client_kind": row.client_kind.value,
                "held_product_count": len(row.held_segments),
            },
        )

    return ClientImportPreviewOut(
        file_sha256=digest,
        source_format=fmt,
        total_data_rows=len(raw_rows),
        valid_row_count=len(final.rows),
        error_count=len(final.errors),
        errors=[ClientImportRowErrorOut(row_number=r, message=m) for r, m in final.errors],
        preview_rows=preview_rows,
    )


@router.post("/commit", response_model=ClientImportCommitOut)
async def commit_client_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientImportCommitOut:
    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhuma planilha enviada.",
        )

    fmt, digest, _raw, final = _run_validation(
        db,
        current_user.organization_id,
        content,
        file.filename,
    )

    if final.errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=[{"row_number": r, "message": m} for r, m in final.errors],
        )

    ingestion = IngestionSource.CSV_IMPORT if fmt == "csv" else IngestionSource.EXCEL_IMPORT
    fn = (file.filename or "upload").strip()[:255]

    try:
        batch = apply_import(
            db,
            organization_id=current_user.organization_id,
            actor_user_id=current_user.id,
            filename=fn,
            file_sha256=digest,
            source_format=fmt,
            ingestion=ingestion,
            rows=final.rows,
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "A importação entra em conflito com e-mail ou ID externo já existente "
                "nesta corretora. Atualize a planilha ou o CRM e tente novamente."
            ),
        ) from None

    return ClientImportCommitOut(
        batch_id=batch.id,
        file_sha256=batch.file_sha256,
        source_format=batch.source_format,
        row_count=batch.row_count,
        inserted_count=batch.inserted_count,
        updated_count=batch.updated_count,
    )
