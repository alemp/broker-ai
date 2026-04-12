"""Phase 9 — batch adequacy refresh, stored snapshots, input fingerprinting."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import UTC, datetime
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session, selectinload

from ai_copilot_api.db.enums import AdequacyTrafficLight, BatchJobStatus
from ai_copilot_api.db.models import BatchJobRun, Client, ClientAdequacySnapshot, ClientHeldProduct
from ai_copilot_api.domain.adequacy_rules import AdequacyAssessment, evaluate_adequacy

ADEQUACY_RULE_VERSION = "phase9-v1"
JOB_TYPE_ADEQUACY_REFRESH = "adequacy_refresh"


def adequacy_inputs_fingerprint(client: Client) -> str:
    """Stable hash of profile + portfolio inputs used for adequacy (debug / change detection)."""
    profile = client.profile_data if isinstance(client.profile_data, dict) else {}
    lob_links = getattr(client, "line_of_business_links", None) or []
    held = getattr(client, "held_products", None) or []
    lob_payload = sorted(
        (str(x.line_of_business_id), x.ingestion_source.value) for x in lob_links
    )
    held_payload = sorted(
        (
            str(h.product_id) if h.product_id else None,
            h.policy_status,
            h.insurer_name,
            h.effective_date.isoformat() if h.effective_date else None,
            h.end_date.isoformat() if h.end_date else None,
        )
        for h in held
    )
    payload: dict[str, Any] = {
        "profile": profile,
        "lobs": lob_payload,
        "held": held_payload,
        "client_kind": client.client_kind.value,
    }
    canonical = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()


def _assessment_from_snapshot(snap: ClientAdequacySnapshot) -> AdequacyAssessment:
    reasons = snap.reasons if isinstance(snap.reasons, list) else []
    codes = snap.profile_alert_codes if isinstance(snap.profile_alert_codes, list) else []
    return AdequacyAssessment(
        traffic_light=snap.traffic_light,
        summary=snap.summary,
        reasons=[str(r) for r in reasons],
        needs_human_review=snap.needs_human_review,
        profile_completeness_score=snap.profile_completeness_score,
        profile_alert_codes=[str(c) for c in codes],
    )


def effective_adequacy_assessment(db: Session, client: Client) -> AdequacyAssessment:
    """Prefer batch snapshot when present; otherwise compute live (Phase 9)."""
    snap = db.scalar(
        select(ClientAdequacySnapshot).where(ClientAdequacySnapshot.client_id == client.id),
    )
    if snap is not None:
        return _assessment_from_snapshot(snap)
    return evaluate_adequacy(client)


def traffic_light_for_segmentation(db: Session, client: Client) -> AdequacyTrafficLight:
    """Traffic light for campaign criteria — batch snapshot when available."""
    return effective_adequacy_assessment(db, client).traffic_light


def _upsert_snapshot(
    db: Session,
    organization_id: uuid.UUID,
    client: Client,
    ad: AdequacyAssessment,
    inputs_hash: str,
) -> None:
    now = datetime.now(UTC)
    stmt = pg_insert(ClientAdequacySnapshot).values(
        id=uuid.uuid4(),
        organization_id=organization_id,
        client_id=client.id,
        traffic_light=ad.traffic_light,
        summary=ad.summary,
        reasons=ad.reasons,
        needs_human_review=ad.needs_human_review,
        profile_completeness_score=ad.profile_completeness_score,
        profile_alert_codes=ad.profile_alert_codes,
        inputs_hash=inputs_hash,
        rule_version=ADEQUACY_RULE_VERSION,
        computed_at=now,
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_client_adequacy_snapshots_client",
        set_={
            "organization_id": stmt.excluded.organization_id,
            "traffic_light": stmt.excluded.traffic_light,
            "summary": stmt.excluded.summary,
            "reasons": stmt.excluded.reasons,
            "needs_human_review": stmt.excluded.needs_human_review,
            "profile_completeness_score": stmt.excluded.profile_completeness_score,
            "profile_alert_codes": stmt.excluded.profile_alert_codes,
            "inputs_hash": stmt.excluded.inputs_hash,
            "rule_version": stmt.excluded.rule_version,
            "computed_at": stmt.excluded.computed_at,
        },
    )
    db.execute(stmt)


def refresh_adequacy_for_organization(db: Session, organization_id: uuid.UUID) -> BatchJobRun:
    """
    Recompute and upsert adequacy snapshots for all clients in the organization.
    Records a BatchJobRun row (SUCCESS or FAILED).
    """
    run = BatchJobRun(
        organization_id=organization_id,
        job_type=JOB_TYPE_ADEQUACY_REFRESH,
        status=BatchJobStatus.RUNNING,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    run_id = run.id

    try:
        clients = db.scalars(
            select(Client)
            .options(
                selectinload(Client.held_products).selectinload(ClientHeldProduct.product),
                selectinload(Client.line_of_business_links),
            )
            .where(Client.organization_id == organization_id),
        ).unique().all()
        n = 0
        for c in clients:
            ad = evaluate_adequacy(c)
            h = adequacy_inputs_fingerprint(c)
            _upsert_snapshot(db, organization_id, c, ad, h)
            n += 1
        run = db.get(BatchJobRun, run_id)
        if run is None:
            raise RuntimeError("batch_job_run row missing after start")  # pragma: no cover
        run.status = BatchJobStatus.SUCCESS
        run.clients_processed = n
        run.finished_at = datetime.now(UTC)
        db.commit()
        db.refresh(run)
        return run
    except Exception as e:
        db.rollback()
        run_done = db.get(BatchJobRun, run_id)
        if run_done is not None:
            run_done.status = BatchJobStatus.FAILED
            run_done.error_message = str(e)[:2000]
            run_done.finished_at = datetime.now(UTC)
            db.commit()
        raise


def refresh_all_organizations_adequacy(db: Session) -> None:
    """Scheduler entrypoint: refresh every organization (separate job row per org)."""
    from ai_copilot_api.db.models import Organization

    org_ids = list(db.scalars(select(Organization.id)).all())
    for oid in org_ids:
        try:
            refresh_adequacy_for_organization(db, oid)
        except Exception:
            # Logged by caller / observability; other orgs still run
            continue


def resolve_adequacy_for_api(
    db: Session,
    client: Client,
    source: Literal["batch_first", "live"],
) -> tuple[AdequacyAssessment, Literal["batch", "live"], datetime | None, str | None, str | None]:
    """Build assessment for GET /adequacy with optional batch preference."""
    if source == "live":
        ad = evaluate_adequacy(client)
        return ad, "live", None, adequacy_inputs_fingerprint(client), ADEQUACY_RULE_VERSION

    snap = db.scalar(
        select(ClientAdequacySnapshot).where(ClientAdequacySnapshot.client_id == client.id),
    )
    if snap is not None:
        return (
            _assessment_from_snapshot(snap),
            "batch",
            snap.computed_at,
            snap.inputs_hash,
            snap.rule_version,
        )
    ad = evaluate_adequacy(client)
    return ad, "live", None, adequacy_inputs_fingerprint(client), ADEQUACY_RULE_VERSION
