"""Canonical Pydantic models for proposal ingest (ADR-PROPOSAL-INGEST §D2).

The canonical payload is the single shape both the JSON and PDF channels
converge to. Adapters in `domain/proposal_adapters` translate carrier-specific
inputs (e.g. Bradesco pt-BR JSON) into this English schema; the same schema
backs the public ingest API in Phase 4.

For the MVP, the only `insurance_line` with a fully modelled payload is
`AUTO_INSURANCE` (`AutoProposalPayload`). Other lines reuse the shared
`ProposalQuote` / `ProposalApplicant` building blocks as they are implemented.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ai_copilot_api.db.enums import ProductCategory


class ProposalQuote(BaseModel):
    """Identifying metadata of the carrier's quotation."""

    model_config = ConfigDict(extra="forbid")

    number: str | None = Field(default=None, max_length=128)
    item: int = Field(default=1, ge=1)
    calculated_at: datetime | None = None
    valid_until: date | None = None
    insurer_name: str = Field(min_length=1, max_length=255)
    insurer_code: str | None = Field(default=None, max_length=64)
    product_name: str | None = Field(default=None, max_length=255)
    product_code: str | None = Field(default=None, max_length=64)
    insurance_type: str | None = Field(default=None, max_length=64)
    customer_type: str | None = Field(default=None, max_length=32)
    bonus_class: int | None = Field(default=None, ge=0, le=20)
    has_claims: bool | None = None
    claims_count: int | None = Field(default=None, ge=0)


class ProposalApplicant(BaseModel):
    """Person or company applying for the policy.

    `tax_id` carries the digits-only CPF/CNPJ; adapters strip punctuation.
    """

    model_config = ConfigDict(extra="forbid")

    full_name: str = Field(min_length=1, max_length=255)
    tax_id: str = Field(min_length=11, max_length=14)
    person_type: str | None = Field(default=None, max_length=16)
    gender: str | None = Field(default=None, max_length=16)
    date_of_birth: date | None = None
    marital_status: str | None = Field(default=None, max_length=64)
    overnight_postal_code: str | None = Field(default=None, max_length=16)
    is_main_driver: bool | None = None
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=64)


class ProposalCoveragePeriod(BaseModel):
    model_config = ConfigDict(extra="forbid")

    starts_at: datetime | None = None
    ends_at: datetime | None = None


class ProposalBrokerage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, max_length=255)
    tax_id: str | None = Field(default=None, max_length=14)
    branch_code: str | None = Field(default=None, max_length=32)
    inspection_code: str | None = Field(default=None, max_length=32)
    cpd: str | None = Field(default=None, max_length=64)


class ProposalVehicle(BaseModel):
    """Auto-insurance subject of risk."""

    model_config = ConfigDict(extra="forbid")

    make: str | None = Field(default=None, max_length=64)
    model: str | None = Field(default=None, max_length=128)
    version: str | None = Field(default=None, max_length=128)
    fabrication_year: int | None = Field(default=None, ge=1900, le=2100)
    model_year: int | None = Field(default=None, ge=1900, le=2100)
    vehicle_code: str | None = Field(default=None, max_length=32)
    plate: str | None = Field(default=None, max_length=16)
    chassis: str | None = Field(default=None, max_length=32)
    fipe_code: str | None = Field(default=None, max_length=16)
    usage: str | None = Field(default=None, max_length=64)
    zero_km: bool | None = None
    tax_exempt: bool | None = None
    door_count: int | None = Field(default=None, ge=0, le=12)
    axle_count: int | None = Field(default=None, ge=0, le=12)
    chassis_reissued: bool | None = None
    transformed: bool | None = None
    has_anti_theft: bool | None = None
    has_equipment: bool | None = None
    has_accessories: bool | None = None
    semi_trailer: bool | None = None
    body_type: str | None = Field(default=None, max_length=64)
    fuel_type: str | None = Field(default=None, max_length=32)


class ProposalMileageBand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    description: str | None = Field(default=None, max_length=128)
    band: str | None = Field(default=None, max_length=64)


class ProposalRiskQuestionnaire(BaseModel):
    model_config = ConfigDict(extra="forbid")

    main_driver: ProposalApplicant | None = None
    young_driver_18_25: bool | None = None
    average_mileage: ProposalMileageBand | None = None


class ProposalLiabilityLimits(BaseModel):
    model_config = ConfigDict(extra="forbid")

    material_damage: Decimal | None = None
    bodily_injury: Decimal | None = None
    moral_damages: Decimal | None = None


class ProposalAccidentalCoverage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    death_per_passenger: Decimal | None = None
    disability_per_passenger: Decimal | None = None
    medical_expenses: Decimal | None = None
    official_capacity: int | None = Field(default=None, ge=0, le=200)


class ProposalHullValuation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    description: str | None = Field(default=None, max_length=128)
    adjustment_percentage: Decimal | None = None


class ProposalAssistance24h(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, max_length=128)
    limit: str | None = Field(default=None, max_length=64)


class ProposalCourtesyCar(BaseModel):
    model_config = ConfigDict(extra="forbid")

    days: int | None = Field(default=None, ge=0, le=365)
    type: str | None = Field(default=None, max_length=64)


class ProposalGlassCoverage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    coverage: str | None = Field(default=None, max_length=64)


class ProposalCoverages(BaseModel):
    """Coverages selected on the quote."""

    model_config = ConfigDict(extra="forbid")

    hull_valuation: ProposalHullValuation | None = None
    comprehensive: bool | None = None
    mercosur_extension: bool | None = None
    assistance_24h: ProposalAssistance24h | None = None
    courtesy_car: ProposalCourtesyCar | None = None
    glass: ProposalGlassCoverage | None = None
    civil_liability: ProposalLiabilityLimits | None = None
    accidental_passengers: ProposalAccidentalCoverage | None = None
    extraordinary_expenses: Decimal | None = None
    armor_coverage: bool | None = None
    gas_kit: bool | None = None
    interior_goods: Decimal | None = None
    daily_immobilization: Decimal | None = None


class ProposalDeductibles(BaseModel):
    model_config = ConfigDict(extra="forbid")

    hull_value: Decimal | None = None
    hull_type: str | None = Field(default=None, max_length=32)
    windshield: Decimal | None = None
    side_glasses: Decimal | None = None
    rear_glass: Decimal | None = None
    tail_lights: Decimal | None = None
    led_tail_lights: Decimal | None = None
    headlights: Decimal | None = None
    xenon_headlights: Decimal | None = None
    led_headlights: Decimal | None = None
    side_mirrors: Decimal | None = None
    window_motors: Decimal | None = None


class ProposalPremium(BaseModel):
    model_config = ConfigDict(extra="forbid")

    net_premium: Decimal | None = None
    iof: Decimal | None = None
    total: Decimal | None = None
    total_payable: Decimal | None = None


class ProposalClause(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(min_length=1, max_length=32)
    description: str = Field(min_length=1, max_length=255)


class AutoProposalPayload(BaseModel):
    """Canonical motor-insurance proposal payload (`insurance_line=AUTO_INSURANCE`)."""

    model_config = ConfigDict(extra="forbid")

    insurance_line: Literal[ProductCategory.AUTO_INSURANCE] = ProductCategory.AUTO_INSURANCE
    quote: ProposalQuote
    applicant: ProposalApplicant
    coverage_period: ProposalCoveragePeriod | None = None
    brokerage: ProposalBrokerage | None = None
    vehicle: ProposalVehicle
    risk_questionnaire: ProposalRiskQuestionnaire | None = None
    coverages: ProposalCoverages
    deductibles: ProposalDeductibles | None = None
    premium: ProposalPremium
    clauses: list[ProposalClause] = Field(default_factory=list)

    @field_validator("insurance_line")
    @classmethod
    def _enforce_auto_line(cls, value: ProductCategory) -> ProductCategory:
        if value != ProductCategory.AUTO_INSURANCE:
            raise ValueError("AutoProposalPayload only accepts insurance_line=AUTO_INSURANCE")
        return value


# ---------------------------------------------------------------------------
# Phase 9 — multi-line proposal payloads
#
# These payloads share the canonical envelope (quote, applicant, premium,
# coverage_period, brokerage, clauses) and add a small line-specific block
# describing the subject of risk. Field-level merge rules into
# `Client.profile_data` are intentionally **not** implemented yet — that
# work follows once a real carrier sample is available per line.
# ---------------------------------------------------------------------------


class ProposalInsuredPerson(BaseModel):
    """Insured natural person for life-insurance proposals."""

    model_config = ConfigDict(extra="forbid")

    full_name: str = Field(min_length=1, max_length=255)
    tax_id: str | None = Field(default=None, min_length=11, max_length=14)
    date_of_birth: date | None = None
    gender: str | None = Field(default=None, max_length=16)
    smoker: bool | None = None
    profession: str | None = Field(default=None, max_length=128)
    relation_to_applicant: str | None = Field(default=None, max_length=64)


class ProposalLifeCoverages(BaseModel):
    """Top-line coverage limits selected on a life-insurance quote.

    Adapters typically populate this from :attr:`LifeProposalPayload.coverage_items`
    by mapping carrier codes (``BASICA_MORTE``, ``IEA``, ``IPA`` …) to canonical
    semantic slots — leaving the raw per-row detail in ``coverage_items``.
    """

    model_config = ConfigDict(extra="forbid")

    death: Decimal | None = None
    accidental_death: Decimal | None = None
    total_disability: Decimal | None = None
    grave_illnesses: Decimal | None = None
    funeral_assistance: Decimal | None = None
    daily_hospital_indemnity: Decimal | None = None


class ProposalLifeCoverageItem(BaseModel):
    """A single coverage row as detailed on a life-insurance quote.

    Captures carrier-side per-coverage detail (code, indemnity %, capital
    bands, premium, accumulability flags) so brokers can review the full
    quote without losing fidelity. Adapters return one item per ``cobertura``
    row found on the carrier payload.
    """

    model_config = ConfigDict(extra="forbid")

    code: str = Field(min_length=1, max_length=64)
    description: str = Field(min_length=1, max_length=255)
    indemnity_percentage: Decimal | None = Field(default=None, ge=0, le=100)
    insured_capital_min: Decimal | None = None
    insured_capital_max: Decimal | None = None
    premium: Decimal | None = None
    accumulable_with_death: bool | None = None
    note: str | None = Field(default=None, max_length=512)


class ProposalLifeGroupProfile(BaseModel):
    """Group / PME life-insurance profile (collective policies).

    For individual life the field is left unset on :class:`LifeProposalPayload`.
    For group plans (PME, RH coletivo) the carrier exposes the eligible
    categories, adhesion rules, capital calculation method and headcount —
    all captured here so the recommendation/adequacy layer can reason about
    coverage versus exposure.
    """

    model_config = ConfigDict(extra="forbid")

    eligible_categories: list[str] = Field(default_factory=list)
    adhesion_type: str | None = Field(default=None, max_length=32)  # compulsory/optional
    funding: str | None = Field(default=None, max_length=32)  # contributory/non-contributory
    has_health_plan: bool | None = None
    previous_carrier_carries_leave: bool | None = None
    accepts_disability_retirees: bool | None = None
    lives_count: int | None = Field(default=None, ge=0, le=100000)
    capital_calculation_method: str | None = Field(default=None, max_length=64)
    salary_multiplier: Decimal | None = None
    total_capital: Decimal | None = None
    note: str | None = Field(default=None, max_length=512)


class ProposalLifeAcceptanceConditions(BaseModel):
    """Underwriting / acceptance conditions for a life-insurance quote."""

    model_config = ConfigDict(extra="forbid")

    full_adhesion_required: bool | None = None
    max_acceptance_age: int | None = Field(default=None, ge=0, le=120)
    medical_questionnaire_threshold_capital: Decimal | None = None
    capital_limits_by_age_band: list[dict[str, Any]] = Field(default_factory=list)
    new_adhesions_above_65_require_proposal: bool | None = None


class LifeProposalPayload(BaseModel):
    """Canonical life-insurance proposal payload (`insurance_line=LIFE_INSURANCE`).

    Supports both **individual** plans (``insured`` populated) and **group /
    PME** plans (``group`` populated, ``insured`` omitted). Adapters fill in
    whichever block matches the carrier product type; the recommendation
    layer reads the ``group`` block to assess collective coverage.
    """

    model_config = ConfigDict(extra="forbid")

    insurance_line: Literal[ProductCategory.LIFE_INSURANCE] = ProductCategory.LIFE_INSURANCE
    quote: ProposalQuote
    applicant: ProposalApplicant
    coverage_period: ProposalCoveragePeriod | None = None
    brokerage: ProposalBrokerage | None = None
    insured: ProposalInsuredPerson | None = None
    group: ProposalLifeGroupProfile | None = None
    beneficiaries_count: int | None = Field(default=None, ge=0, le=20)
    coverages: ProposalLifeCoverages = Field(default_factory=ProposalLifeCoverages)
    coverage_items: list[ProposalLifeCoverageItem] = Field(default_factory=list)
    acceptance_conditions: ProposalLifeAcceptanceConditions | None = None
    premium: ProposalPremium
    clauses: list[ProposalClause] = Field(default_factory=list)


class ProposalHomeSubject(BaseModel):
    """Insured property for home-insurance proposals."""

    model_config = ConfigDict(extra="forbid")

    address_line: str | None = Field(default=None, max_length=255)
    postal_code: str | None = Field(default=None, max_length=16)
    city: str | None = Field(default=None, max_length=128)
    state: str | None = Field(default=None, max_length=64)
    occupancy: str | None = Field(default=None, max_length=64)  # owner/tenant
    construction_type: str | None = Field(default=None, max_length=64)
    built_area_sqm: Decimal | None = None
    declared_value: Decimal | None = None


class ProposalHomeCoverages(BaseModel):
    """Coverage limits selected on a home-insurance quote."""

    model_config = ConfigDict(extra="forbid")

    fire: Decimal | None = None
    water_damage: Decimal | None = None
    theft: Decimal | None = None
    civil_liability: Decimal | None = None
    glass: Decimal | None = None
    electrical_damage: Decimal | None = None


class HomeProposalPayload(BaseModel):
    """Canonical home-insurance proposal payload (`insurance_line=GENERAL_INSURANCE`).

    Home and Business proposals both fall under the ``GENERAL_INSURANCE``
    line — they are discriminated downstream by the ``subject_kind`` literal
    so a discriminated union still works.
    """

    model_config = ConfigDict(extra="forbid")

    insurance_line: Literal[ProductCategory.GENERAL_INSURANCE] = ProductCategory.GENERAL_INSURANCE
    subject_kind: Literal["home"] = "home"
    quote: ProposalQuote
    applicant: ProposalApplicant
    coverage_period: ProposalCoveragePeriod | None = None
    brokerage: ProposalBrokerage | None = None
    subject: ProposalHomeSubject
    coverages: ProposalHomeCoverages = Field(default_factory=ProposalHomeCoverages)
    premium: ProposalPremium
    clauses: list[ProposalClause] = Field(default_factory=list)


class ProposalBusinessSubject(BaseModel):
    """Insured business for ramos-elementares / SME proposals."""

    model_config = ConfigDict(extra="forbid")

    legal_name: str = Field(min_length=1, max_length=255)
    tax_id: str = Field(min_length=14, max_length=14)
    cnae: str | None = Field(default=None, max_length=16)
    segment: str | None = Field(default=None, max_length=128)
    location_kind: str | None = Field(default=None, max_length=64)  # owned/rented
    annual_revenue: Decimal | None = None
    headcount: int | None = Field(default=None, ge=0, le=10000)
    address_line: str | None = Field(default=None, max_length=255)


class ProposalBusinessCoverages(BaseModel):
    """Coverage limits selected on a SME multirisco quote."""

    model_config = ConfigDict(extra="forbid")

    fire: Decimal | None = None
    civil_liability: Decimal | None = None
    business_interruption: Decimal | None = None
    theft: Decimal | None = None
    electrical_damage: Decimal | None = None
    professional_indemnity: Decimal | None = None


class BusinessProposalPayload(BaseModel):
    """Canonical SME/multirisco proposal payload (`insurance_line=GENERAL_INSURANCE`)."""

    model_config = ConfigDict(extra="forbid")

    insurance_line: Literal[ProductCategory.GENERAL_INSURANCE] = ProductCategory.GENERAL_INSURANCE
    subject_kind: Literal["business"] = "business"
    quote: ProposalQuote
    applicant: ProposalApplicant
    coverage_period: ProposalCoveragePeriod | None = None
    brokerage: ProposalBrokerage | None = None
    subject: ProposalBusinessSubject
    coverages: ProposalBusinessCoverages = Field(default_factory=ProposalBusinessCoverages)
    premium: ProposalPremium
    clauses: list[ProposalClause] = Field(default_factory=list)


# Type alias used by adapter selection / API dispatch. The two GENERAL_INSURANCE
# payloads share the same ``insurance_line`` so callers must also supply
# ``subject_kind`` when the line is GENERAL — see :func:`select_proposal_payload_class`.
ProposalPayload = (
    AutoProposalPayload | LifeProposalPayload | HomeProposalPayload | BusinessProposalPayload
)


def select_proposal_payload_class(
    insurance_line: ProductCategory,
    *,
    subject_kind: Literal["home", "business"] | None = None,
) -> type[ProposalPayload]:
    """Return the canonical Pydantic class for a given ``insurance_line`` (Phase 9).

    For ``GENERAL_INSURANCE`` the caller must specify ``subject_kind`` — the
    line covers both home (multirisco habitacional) and business (PME
    multirisco) proposals which share the same regulatory line but very
    different schemas.

    Raises :class:`NotImplementedError` for lines without a canonical payload
    yet (currently only ``HEALTH_INSURANCE``); the API layer should surface
    that as a 422.
    """
    if insurance_line == ProductCategory.AUTO_INSURANCE:
        return AutoProposalPayload
    if insurance_line == ProductCategory.LIFE_INSURANCE:
        return LifeProposalPayload
    if insurance_line == ProductCategory.GENERAL_INSURANCE:
        if subject_kind == "home":
            return HomeProposalPayload
        if subject_kind == "business":
            return BusinessProposalPayload
        raise NotImplementedError(
            "GENERAL_INSURANCE proposals require subject_kind in {'home', 'business'}",
        )
    raise NotImplementedError(
        f"No canonical proposal payload defined for insurance_line={insurance_line.value}",
    )


class ProposalAutoIngestBody(BaseModel):
    """Request body for JSON proposal ingest (Phase 4).

    `source` selects the adapter (`bradesco_json_v1`, `bradesco_v1`, `canonical_auto_v1`, …).
    `payload` is the raw JSON object passed to the adapter (or the canonical dict when using
    `canonical_auto_v1`).
    """

    model_config = ConfigDict(extra="forbid")

    source: str = Field(min_length=1, max_length=64)
    payload: dict[str, Any]
    owner_id: uuid.UUID | None = Field(
        default=None,
        description="Opportunity owner; defaults to the authenticated user.",
    )
    create_lead_if_missing: bool = Field(
        default=True,
        description="When no Client/Lead matches the applicant tax id, create a Lead on commit.",
    )


class ProposalIngestPreviewOut(BaseModel):
    """Read-only response of a dry-run extraction or ingest."""

    model_config = ConfigDict(from_attributes=True)

    opportunity_id: uuid.UUID | None = Field(
        default=None,
        description="Existing opportunity matching the idempotency tuple, if any.",
    )
    party_id: uuid.UUID | None = Field(
        default=None,
        description="Resolved party when one exists without creating a lead.",
    )
    party_kind: Literal["client", "lead"] | None = Field(
        default=None,
        description="Kind of `party_id` when set.",
    )
    would_create_lead: bool = Field(
        default=False,
        description="True on preview when commit would create a new lead (no matching party).",
    )
    proposal_source: str
    payload: (
        AutoProposalPayload
        | LifeProposalPayload
        | HomeProposalPayload
        | BusinessProposalPayload
        | None
    )
    confidence: int = Field(ge=0, le=100)
    requires_review: bool
    validation_errors: list[dict[str, Any]] = Field(default_factory=list)
    extraction_meta: dict[str, Any] = Field(default_factory=dict)


class ProposalIngestResultOut(ProposalIngestPreviewOut):
    """Response after extract or JSON commit; includes persistence ids when applicable."""

    document_id: uuid.UUID | None = None
    extraction_run_id: uuid.UUID | None = None
    applied: bool = False
