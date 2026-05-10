from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ai_copilot_api.api.deps import get_current_user, require_admin
from ai_copilot_api.config import Settings, get_settings
from ai_copilot_api.db.enums import BatchJobStatus, DocumentType
from ai_copilot_api.db.models import (
    BatchJobRun,
    CoverageTaxonomy,
    Document,
    DocumentExtractionRun,
    Opportunity,
    User,
)
from ai_copilot_api.db.session import get_db, new_session
from ai_copilot_api.domain.coverage_normalization import normalize_coverages
from ai_copilot_api.domain.document_extraction import (
    extract_pdf_text_with_ocr,
    extract_structured_with_text,
)
from ai_copilot_api.domain.proposal_adapters import select_adapter_for_pdf
from ai_copilot_api.domain.proposal_ingest import (
    apply_auto_proposal_to_opportunity,
    resolve_party,
)
from ai_copilot_api.schemas.crm import BatchJobRunOut
from ai_copilot_api.schemas.extraction import DocumentExtractionConfirmIn, DocumentExtractionRunOut
from ai_copilot_api.schemas.proposal_ingest import AutoProposalPayload
from ai_copilot_api.storage.factory import get_object_storage

# Phase 6: when a PROPOSAL document is linked to an opportunity and the canonical
# payload validates, we auto-apply only when extractor confidence is at least
# this threshold. Lower scores are persisted with `requires_review=True` so a
# human can confirm via `PATCH /v1/documents/extractions/{run_id}/confirm`.
PROPOSAL_AUTO_APPLY_MIN_CONFIDENCE = 70

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


def _validation_errors_payload(exc: ValidationError) -> list[dict[str, Any]]:
    return [
        {"loc": list(err.get("loc", ())), "msg": err.get("msg"), "type": err.get("type")}
        for err in exc.errors()
    ]


def _run_proposal_extraction_for_opportunity(
    db: Session,
    *,
    doc: Document,
    opp: Opportunity,
    requested_by_id: uuid.UUID,
    raw_text: str,
    extraction_meta: dict[str, Any],
) -> None:
    """Phase 6 — proposal-aware extraction for documents linked to an opportunity.

    Reads `insurance_line` from the **opportunity** (not from the request),
    runs the matching adapter, persists a `DocumentExtractionRun`, and
    auto-applies via :func:`apply_auto_proposal_to_opportunity` when the
    canonical payload validates with ``confidence >= PROPOSAL_AUTO_APPLY_MIN_CONFIDENCE``.
    Otherwise the run is flagged ``requires_review=True`` and the existing
    ``PATCH .../extractions/{run_id}/confirm`` flow can take over.
    """
    org_id = opp.organization_id
    compact_text = " ".join(raw_text.split())

    validation_errors: list[dict[str, Any]] = []
    payload: AutoProposalPayload | None = None
    canonical_dict: dict[str, Any] | None = None
    proposal_source: str | None = None
    confidence = 0
    requires_review = True

    try:
        adapter = select_adapter_for_pdf(opp.insurance_line)
    except NotImplementedError as exc:
        validation_errors.append({"msg": str(exc), "type": "adapter_unsupported"})
        run = DocumentExtractionRun(
            organization_id=org_id,
            document_id=doc.id,
            created_by_id=requested_by_id,
            confidence=0,
            requires_review=True,
            extracted_data={
                "insurance_line": opp.insurance_line.value,
                "extraction_meta": extraction_meta,
                "validation_errors": validation_errors,
                "applied": False,
            },
            normalized_data={"payload": None},
        )
        db.add(run)
        return

    proposal_source = adapter.source
    canonical_dict = adapter.to_canonical_dict(
        {"compact_text": compact_text, "raw_text": raw_text},
    )
    try:
        payload = AutoProposalPayload.model_validate(canonical_dict)
        confidence = 80
        requires_review = False
    except ValidationError as exc:
        validation_errors = _validation_errors_payload(exc)

    applied = False
    if payload is not None and confidence >= PROPOSAL_AUTO_APPLY_MIN_CONFIDENCE:
        try:
            party = resolve_party(db, org_id, payload.applicant, opportunity=opp)
        except LookupError as exc:
            requires_review = True
            confidence = min(confidence, PROPOSAL_AUTO_APPLY_MIN_CONFIDENCE - 1)
            validation_errors.append(
                {"msg": str(exc), "type": "party_resolution_error"},
            )
        else:
            apply_auto_proposal_to_opportunity(
                db,
                opportunity=opp,
                payload=payload,
                proposal_source=adapter.source,
                actor_user_id=requested_by_id,
                party=party,
            )
            applied = True

    run = DocumentExtractionRun(
        organization_id=org_id,
        document_id=doc.id,
        created_by_id=requested_by_id,
        confidence=confidence,
        requires_review=requires_review,
        extracted_data={
            "insurance_line": opp.insurance_line.value,
            "canonical_dict": canonical_dict,
            "extraction_meta": extraction_meta,
            "validation_errors": validation_errors,
            "proposal_source": proposal_source,
            "applied": applied,
        },
        normalized_data={"payload": payload.model_dump(mode="json") if payload else None},
    )
    db.add(run)


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

        requested_by = job.job_meta.get("requested_by_id")
        requested_by_id = uuid.UUID(requested_by) if isinstance(requested_by, str) else None
        if requested_by_id is None:
            raise ValueError("requested_by_id missing from job_meta")

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

        # Phase 6: proposal-aware path runs when a PROPOSAL document is linked
        # to an opportunity. We read `insurance_line` from the opportunity and
        # auto-apply the canonical payload when extractor confidence is high.
        if (
            doc.opportunity_id is not None
            and doc.document_type == DocumentType.PROPOSAL
        ):
            opp = db.scalar(
                select(Opportunity).where(
                    Opportunity.id == doc.opportunity_id,
                    Opportunity.organization_id == org_id,
                ),
            )
            if opp is not None:
                _run_proposal_extraction_for_opportunity(
                    db,
                    doc=doc,
                    opp=opp,
                    requested_by_id=requested_by_id,
                    raw_text=raw_text,
                    extraction_meta=extraction_meta,
                )
                job.status = BatchJobStatus.SUCCESS
                job.clients_processed = 1
                job.finished_at = datetime.now(UTC)
                db.commit()
                return

        # Legacy free-form structured extraction (no opportunity linkage).
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

