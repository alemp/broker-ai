from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ai_copilot_api.api.deps import get_current_user, require_admin
from ai_copilot_api.config import Settings, get_settings
from ai_copilot_api.db.enums import BatchJobStatus
from ai_copilot_api.db.models import (
    BatchJobRun,
    CoverageTaxonomy,
    Document,
    DocumentExtractionRun,
    User,
)
from ai_copilot_api.db.session import get_db, new_session
from ai_copilot_api.domain.coverage_normalization import normalize_coverages
from ai_copilot_api.domain.document_extraction import (
    extract_pdf_text_with_ocr,
    extract_structured_with_text,
)
from ai_copilot_api.schemas.crm import BatchJobRunOut
from ai_copilot_api.schemas.extraction import DocumentExtractionConfirmIn, DocumentExtractionRunOut
from ai_copilot_api.storage.factory import get_object_storage

router = APIRouter(prefix="/documents", tags=["document-extraction"])

JOB_TYPE_DOCUMENT_EXTRACTION = "document_extraction"


def _load_taxonomy(db: Session, org_id: uuid.UUID) -> list[dict[str, object]]:
    rows = db.scalars(
        select(CoverageTaxonomy).where(
            CoverageTaxonomy.organization_id == org_id,
            CoverageTaxonomy.active.is_(True),
        ),
    ).all()
    return [{"code": r.code, "label": r.label, "synonyms": r.synonyms} for r in rows]


def _run_document_extraction_job(job_id: uuid.UUID, *, settings: Settings) -> None:
    db = new_session()
    try:
        job = db.get(BatchJobRun, job_id)
        if job is None:
            return
        org_id_raw = job.job_meta.get("organization_id")
        doc_id_raw = job.job_meta.get("document_id")
        if not isinstance(org_id_raw, str) or not isinstance(doc_id_raw, str):
            job.status = BatchJobStatus.FAILED
            job.error_message = "Invalid job_meta"
            job.finished_at = datetime.now(UTC)
            db.commit()
            return
        org_id = uuid.UUID(org_id_raw)
        document_id = uuid.UUID(doc_id_raw)

        doc = db.scalar(
            select(Document).where(Document.id == document_id, Document.organization_id == org_id),
        )
        if doc is None:
            job.status = BatchJobStatus.FAILED
            job.error_message = "Document not found"
            job.finished_at = datetime.now(UTC)
            db.commit()
            return

        storage = get_object_storage(settings)
        pdf_bytes = storage.get_object(doc.storage_key)
        raw_text, extraction_meta = extract_pdf_text_with_ocr(
            pdf_bytes,
            ocr_enabled=settings.ocr_enabled,
            min_text_chars=settings.ocr_min_text_chars,
            language=settings.ocr_language,
            provider_url=settings.ocr_provider_url,
            provider_timeout_seconds=settings.ocr_provider_timeout_seconds,
            provider_max_pages=settings.ocr_provider_max_pages,
            provider_dpi=settings.ocr_provider_dpi,
        )
        compact = " ".join(raw_text.split())
        result = extract_structured_with_text(
            doc.document_type,
            compact_text=compact,
            raw_text=raw_text,
            extraction_meta=extraction_meta,
        )

        taxonomy = _load_taxonomy(db, org_id)
        if isinstance(result.extracted_data, dict):
            coverages_raw = result.extracted_data.get("coverages")
        else:
            coverages_raw = []
        coverages_list = coverages_raw if isinstance(coverages_raw, list) else []
        normalized = normalize_coverages([str(c) for c in coverages_list], taxonomy=taxonomy)
        normalized_out = [
            {
                "raw": n.raw,
                "code": n.code,
                "label": n.label,
                "confidence": n.confidence,
                "matched_synonym": n.matched_synonym,
            }
            for n in normalized
        ]

        requested_by = job.job_meta.get("requested_by_id")
        requested_by_id = uuid.UUID(requested_by) if isinstance(requested_by, str) else None
        if requested_by_id is None:
            raise ValueError("requested_by_id missing from job_meta")

        run = DocumentExtractionRun(
            organization_id=org_id,
            document_id=doc.id,
            created_by_id=requested_by_id,
            confidence=result.confidence,
            requires_review=result.requires_review,
            extracted_data=result.extracted_data,
            normalized_data={"coverages": normalized_out},
        )
        db.add(run)

        job.status = BatchJobStatus.SUCCESS
        job.clients_processed = 1
        job.finished_at = datetime.now(UTC)
        db.commit()
    except Exception as e:
        db.rollback()
        job = db.get(BatchJobRun, job_id)
        if job is not None:
            job.status = BatchJobStatus.FAILED
            job.error_message = str(e)[:2000]
            job.finished_at = datetime.now(UTC)
            db.commit()
    finally:
        db.close()


@router.post("/{document_id}/extract", response_model=BatchJobRunOut, status_code=202)
def extract_document(
    document_id: uuid.UUID,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(require_admin),
) -> BatchJobRun:
    doc = db.scalar(
        select(Document).where(
            Document.id == document_id,
            Document.organization_id == current_user.organization_id,
        ),
    )
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    job = BatchJobRun(
        organization_id=current_user.organization_id,
        job_type=JOB_TYPE_DOCUMENT_EXTRACTION,
        status=BatchJobStatus.RUNNING,
        job_meta={
            "organization_id": str(current_user.organization_id),
            "document_id": str(document_id),
            "requested_by_id": str(current_user.id),
        },
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background.add_task(_run_document_extraction_job, job.id, settings=settings)
    return job


@router.get(
    "/{document_id}/extractions",
    response_model=list[DocumentExtractionRunOut],
)
def list_extractions_for_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DocumentExtractionRunOut]:
    doc_exists = db.scalar(
        select(Document.id).where(
            Document.id == document_id,
            Document.organization_id == current_user.organization_id,
        ),
    )
    if doc_exists is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    stmt = (
        select(DocumentExtractionRun)
        .options(
            joinedload(DocumentExtractionRun.created_by_user),
            joinedload(DocumentExtractionRun.confirmed_by_user),
        )
        .where(
            DocumentExtractionRun.document_id == document_id,
            DocumentExtractionRun.organization_id == current_user.organization_id,
        )
        .order_by(DocumentExtractionRun.created_at.desc())
    )
    rows = db.scalars(stmt).unique().all()
    return [DocumentExtractionRunOut.model_validate(r) for r in rows]


@router.patch(
    "/extractions/{run_id}/confirm",
    response_model=DocumentExtractionRunOut,
)
def confirm_extraction(
    run_id: uuid.UUID,
    body: DocumentExtractionConfirmIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> DocumentExtractionRunOut:
    run = db.scalar(
        select(DocumentExtractionRun)
        .options(
            joinedload(DocumentExtractionRun.created_by_user),
            joinedload(DocumentExtractionRun.confirmed_by_user),
        )
        .where(
            DocumentExtractionRun.id == run_id,
            DocumentExtractionRun.organization_id == current_user.organization_id,
        ),
    )
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Extraction run not found",
        )

    run.extracted_data = body.extracted_data
    run.normalized_data = body.normalized_data
    run.requires_review = False
    run.confidence = 100
    run.confirmed_by_id = current_user.id
    run.confirmed_at = datetime.now(UTC)
    db.commit()
    db.refresh(run)
    run = db.scalar(
        select(DocumentExtractionRun)
        .options(
            joinedload(DocumentExtractionRun.created_by_user),
            joinedload(DocumentExtractionRun.confirmed_by_user),
        )
        .where(DocumentExtractionRun.id == run.id),
    )
    assert run is not None
    return DocumentExtractionRunOut.model_validate(run)

