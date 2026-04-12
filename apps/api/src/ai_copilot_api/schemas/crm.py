from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal, Self

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from ai_copilot_api.db.enums import (
    AdequacyTrafficLight,
    BatchJobStatus,
    CampaignKind,
    CampaignTouchStatus,
    ClientKind,
    CrmAuditAction,
    CrmEntityType,
    IngestionSource,
    InsuredRelation,
    InteractionType,
    LeadStatus,
    OpportunityStage,
    OpportunityStatus,
    ProductCategory,
    ProductRiskLevel,
    RecommendationFeedbackAction,
)
from ai_copilot_api.schemas.client_profile import ClientInsuranceProfile


class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str | None


class ClientBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: str | None


class LeadBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: str | None


class ClientCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=64)
    external_id: str | None = Field(default=None, max_length=128)
    notes: str | None = None
    owner_id: uuid.UUID | None = None
    client_kind: ClientKind = ClientKind.INDIVIDUAL
    company_legal_name: str | None = Field(default=None, max_length=255)
    company_tax_id: str | None = Field(default=None, max_length=32)
    marketing_opt_in: bool = True
    preferred_marketing_channel: str | None = Field(default=None, max_length=64)

    @model_validator(mode="after")
    def require_company_legal_name(self) -> Self:
        if self.client_kind == ClientKind.COMPANY and not (
            self.company_legal_name and self.company_legal_name.strip()
        ):
            raise ValueError("company_legal_name is required when client_kind is COMPANY")
        return self


class ClientUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=64)
    external_id: str | None = Field(default=None, max_length=128)
    notes: str | None = None
    owner_id: uuid.UUID | None = None
    client_kind: ClientKind | None = None
    company_legal_name: str | None = Field(default=None, max_length=255)
    company_tax_id: str | None = Field(default=None, max_length=32)
    marketing_opt_in: bool | None = None
    preferred_marketing_channel: str | None = Field(default=None, max_length=64)


class ClientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    external_id: str | None
    email: str | None
    phone: str | None
    full_name: str
    notes: str | None
    owner_id: uuid.UUID | None
    client_kind: ClientKind
    company_legal_name: str | None
    company_tax_id: str | None
    marketing_opt_in: bool
    preferred_marketing_channel: str | None
    created_at: datetime
    updated_at: datetime
    owner: UserBrief | None = Field(default=None, validation_alias="owner")
    adequacy_traffic_light: AdequacyTrafficLight | None = None
    adequacy_computed_at: datetime | None = None


class ClientHeldProductCreate(BaseModel):
    product_id: uuid.UUID | None = None
    insurer_name: str | None = Field(default=None, max_length=255)
    policy_status: str | None = Field(default=None, max_length=64)
    effective_date: date | None = None
    end_date: date | None = None
    ingestion_source: IngestionSource = IngestionSource.INTERNAL_CRM
    notes: str | None = None


class ClientHeldProductUpdate(BaseModel):
    product_id: uuid.UUID | None = None
    insurer_name: str | None = Field(default=None, max_length=255)
    policy_status: str | None = Field(default=None, max_length=64)
    effective_date: date | None = None
    end_date: date | None = None
    notes: str | None = None


class ProductBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    category: ProductCategory


class InsurerBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    code: str | None


class InsurerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    code: str | None = Field(default=None, max_length=64)
    active: bool = True
    notes: str | None = None


class InsurerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    code: str | None = Field(default=None, max_length=64)
    active: bool | None = None
    notes: str | None = None


class InsurerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    code: str | None
    active: bool
    notes: str | None
    created_at: datetime


class ClientHeldProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    product_id: uuid.UUID | None
    insurer_name: str | None
    policy_status: str | None
    effective_date: date | None
    end_date: date | None
    ingestion_source: IngestionSource
    notes: str | None
    created_at: datetime
    updated_at: datetime
    product: ProductBrief | None


class InsuredPersonCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    relation: InsuredRelation = InsuredRelation.HOLDER
    notes: str | None = None


class InsuredPersonUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    relation: InsuredRelation | None = None
    notes: str | None = None


class InsuredPersonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    client_id: uuid.UUID
    full_name: str
    relation: InsuredRelation
    notes: str | None
    created_at: datetime
    updated_at: datetime


class ClientImportRowErrorOut(BaseModel):
    row_number: int
    message: str


class ClientImportPreviewOut(BaseModel):
    file_sha256: str
    source_format: str
    total_data_rows: int
    valid_row_count: int
    error_count: int
    errors: list[ClientImportRowErrorOut]
    preview_rows: list[dict[str, Any]]


class ClientImportCommitOut(BaseModel):
    batch_id: uuid.UUID
    file_sha256: str
    source_format: str
    row_count: int
    inserted_count: int
    updated_count: int


class CrmAuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    actor_user_id: uuid.UUID
    entity_type: CrmEntityType
    entity_id: uuid.UUID
    action: CrmAuditAction
    field_name: str | None
    old_value: str | None
    new_value: str | None
    created_at: datetime


class ClientDetailOut(ClientOut):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    held_products: list[ClientHeldProductOut]
    insured_persons: list[InsuredPersonOut] = Field(default_factory=list)
    profile: ClientInsuranceProfile = Field(default_factory=ClientInsuranceProfile)
    profile_completeness_score: int = Field(default=0, ge=0, le=100)
    profile_alerts: list[str] = Field(default_factory=list)


class LeadCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=64)
    external_id: str | None = Field(default=None, max_length=128)
    source: str | None = Field(default=None, max_length=255)
    notes: str | None = None
    owner_id: uuid.UUID | None = None
    status: LeadStatus = LeadStatus.NEW
    client_kind: ClientKind = ClientKind.INDIVIDUAL
    company_legal_name: str | None = Field(default=None, max_length=255)
    company_tax_id: str | None = Field(default=None, max_length=32)
    marketing_opt_in: bool = True
    preferred_marketing_channel: str | None = Field(default=None, max_length=64)
    profile_data: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def require_company_legal_name(self) -> Self:
        if self.client_kind == ClientKind.COMPANY and not (
            self.company_legal_name and self.company_legal_name.strip()
        ):
            raise ValueError("company_legal_name is required when client_kind is COMPANY")
        return self


class LeadUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=64)
    external_id: str | None = Field(default=None, max_length=128)
    source: str | None = Field(default=None, max_length=255)
    notes: str | None = None
    owner_id: uuid.UUID | None = None
    status: LeadStatus | None = None
    client_kind: ClientKind | None = None
    company_legal_name: str | None = Field(default=None, max_length=255)
    company_tax_id: str | None = Field(default=None, max_length=32)
    marketing_opt_in: bool | None = None
    preferred_marketing_channel: str | None = Field(default=None, max_length=64)
    profile_data: dict[str, Any] | None = None


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    owner_id: uuid.UUID | None
    external_id: str | None
    full_name: str
    email: str | None
    phone: str | None
    source: str | None
    notes: str | None
    client_kind: ClientKind
    company_legal_name: str | None
    company_tax_id: str | None
    marketing_opt_in: bool
    preferred_marketing_channel: str | None
    profile_data: dict[str, Any]
    status: LeadStatus
    converted_client_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    owner: UserBrief | None = Field(default=None, validation_alias="owner_user")


class LeadOpportunityPayload(BaseModel):
    owner_id: uuid.UUID
    product_id: uuid.UUID | None = None
    estimated_value: Decimal | None = None
    closing_probability: int = Field(default=0, ge=0, le=100)
    stage: OpportunityStage = OpportunityStage.LEAD
    status: OpportunityStatus = OpportunityStatus.OPEN
    source: str | None = Field(default=None, max_length=255)
    last_interaction_at: datetime | None = None
    next_action: str | None = None
    next_action_due_at: datetime | None = None
    preferred_insurer_name: str | None = Field(default=None, max_length=255)
    expected_close_at: datetime | None = None
    loss_reason: str | None = None

    @model_validator(mode="after")
    def loss_reason_when_lost_on_convert(self) -> Self:
        if self.stage == OpportunityStage.CLOSED_LOST:
            if not (self.loss_reason and str(self.loss_reason).strip()):
                raise ValueError("loss_reason is required when stage is CLOSED_LOST")
        return self


class LeadConvertRequest(BaseModel):
    """Optional override for Client.owner_id; defaults to lead.owner_id when omitted."""

    client_owner_id: uuid.UUID | None = None
    opportunity: LeadOpportunityPayload | None = None


class LeadConvertResponse(BaseModel):
    client: ClientOut
    opportunity: OpportunityOut | None = None


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    category: ProductCategory
    description: str | None = None
    risk_level: ProductRiskLevel
    target_tags: str | None = Field(default=None, max_length=512)
    active: bool = True
    insurer_id: uuid.UUID | None = None
    main_coverage_summary: str | None = None
    additional_coverages: list[dict[str, Any]] = Field(default_factory=list)
    exclusions_notes: str | None = None
    recommended_profile_summary: str | None = None
    commercial_arguments: str | None = None
    support_materials: list[dict[str, Any]] = Field(default_factory=list)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    category: ProductCategory | None = None
    description: str | None = None
    risk_level: ProductRiskLevel | None = None
    target_tags: str | None = Field(default=None, max_length=512)
    active: bool | None = None
    insurer_id: uuid.UUID | None = None
    main_coverage_summary: str | None = None
    additional_coverages: list[dict[str, Any]] | None = None
    exclusions_notes: str | None = None
    recommended_profile_summary: str | None = None
    commercial_arguments: str | None = None
    support_materials: list[dict[str, Any]] | None = None


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    category: ProductCategory
    description: str | None
    risk_level: ProductRiskLevel
    target_tags: str | None
    active: bool
    insurer_id: uuid.UUID | None
    main_coverage_summary: str | None
    additional_coverages: list[dict[str, Any]]
    exclusions_notes: str | None
    recommended_profile_summary: str | None
    commercial_arguments: str | None
    support_materials: list[dict[str, Any]]
    created_at: datetime
    insurer: InsurerBrief | None = Field(default=None, validation_alias="insurer")


class OpportunityCreate(BaseModel):
    client_id: uuid.UUID | None = None
    lead_id: uuid.UUID | None = None
    owner_id: uuid.UUID
    product_id: uuid.UUID | None = None
    estimated_value: Decimal | None = None
    closing_probability: int = Field(default=0, ge=0, le=100)
    stage: OpportunityStage = OpportunityStage.LEAD
    status: OpportunityStatus = OpportunityStatus.OPEN
    source: str | None = Field(default=None, max_length=255)
    last_interaction_at: datetime | None = None
    next_action: str | None = None
    next_action_due_at: datetime | None = None
    preferred_insurer_name: str | None = Field(default=None, max_length=255)
    expected_close_at: datetime | None = None
    loss_reason: str | None = None

    @model_validator(mode="after")
    def exactly_one_party(self) -> Self:
        cid, lid = self.client_id, self.lead_id
        if (cid is None) == (lid is None):
            raise ValueError("Exactly one of client_id or lead_id is required")
        return self

    @model_validator(mode="after")
    def loss_reason_when_lost_on_create(self) -> Self:
        if self.stage == OpportunityStage.CLOSED_LOST:
            if not (self.loss_reason and str(self.loss_reason).strip()):
                raise ValueError("loss_reason is required when stage is CLOSED_LOST")
        return self


class OpportunityUpdate(BaseModel):
    owner_id: uuid.UUID | None = None
    product_id: uuid.UUID | None = None
    estimated_value: Decimal | None = None
    closing_probability: int | None = Field(default=None, ge=0, le=100)
    stage: OpportunityStage | None = None
    status: OpportunityStatus | None = None
    source: str | None = Field(default=None, max_length=255)
    last_interaction_at: datetime | None = None
    next_action: str | None = None
    next_action_due_at: datetime | None = None
    preferred_insurer_name: str | None = Field(default=None, max_length=255)
    expected_close_at: datetime | None = None
    loss_reason: str | None = None


class OpportunityStagePatch(BaseModel):
    stage: OpportunityStage
    loss_reason: str | None = Field(default=None, max_length=4000)

    @model_validator(mode="after")
    def loss_reason_when_closing_lost(self) -> Self:
        if self.stage == OpportunityStage.CLOSED_LOST:
            if not (self.loss_reason and str(self.loss_reason).strip()):
                raise ValueError("loss_reason is required when moving to CLOSED_LOST")
        return self


class OpportunityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    client_id: uuid.UUID | None
    lead_id: uuid.UUID | None
    owner_id: uuid.UUID
    product_id: uuid.UUID | None
    estimated_value: Decimal | None
    closing_probability: int
    stage: OpportunityStage
    status: OpportunityStatus
    source: str | None
    last_interaction_at: datetime | None
    next_action: str | None
    next_action_due_at: datetime | None
    preferred_insurer_name: str | None
    expected_close_at: datetime | None
    loss_reason: str | None
    created_at: datetime
    updated_at: datetime
    client: ClientBrief | None = None
    lead: LeadBrief | None = None
    owner: UserBrief
    product: ProductBrief | None


class OpportunityMetricsSummary(BaseModel):
    """Lightweight funnel metrics (PRODUCT.md §5.4 dashboards — MVP slice)."""

    by_stage: dict[str, int]
    by_owner_open: dict[str, int]
    open_total: int


class InteractionCreate(BaseModel):
    client_id: uuid.UUID | None = None
    lead_id: uuid.UUID | None = None
    opportunity_id: uuid.UUID | None = None
    interaction_type: InteractionType
    summary: str = Field(min_length=1)
    occurred_at: datetime | None = None
    opportunity_next_action: str | None = None
    opportunity_next_action_due_at: datetime | None = None

    @model_validator(mode="after")
    def exactly_one_party(self) -> Self:
        if (self.client_id is None) == (self.lead_id is None):
            raise ValueError("Exactly one of client_id or lead_id is required")
        return self


class InteractionUpdate(BaseModel):
    interaction_type: InteractionType | None = None
    summary: str | None = Field(default=None, min_length=1)
    occurred_at: datetime | None = None
    opportunity_id: uuid.UUID | None = None


class InteractionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    client_id: uuid.UUID | None
    lead_id: uuid.UUID | None
    opportunity_id: uuid.UUID | None
    created_by_id: uuid.UUID
    interaction_type: InteractionType
    summary: str
    occurred_at: datetime
    created_at: datetime
    created_by: UserBrief = Field(validation_alias="created_by_user")


# --- PRODUCT.md §5.7–5.9 (pre–Phase 6) — recommendations, adequacy, campaigns ---


class RecommendationRunCreate(BaseModel):
    opportunity_id: uuid.UUID | None = None


class RecommendationItemOut(BaseModel):
    product_id: uuid.UUID
    product_name: str
    product_category: ProductCategory
    priority: int
    rule_ids: list[str]
    rationale: str
    protection_gaps: str
    predictable_objections: str
    next_best_action: str


class RuleTraceOut(BaseModel):
    rule_id: str
    fired: bool
    detail: str


class RecommendationRunOut(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    client_id: uuid.UUID
    opportunity_id: uuid.UUID | None
    created_by_id: uuid.UUID
    items: list[RecommendationItemOut]
    rule_trace: list[RuleTraceOut]
    created_at: datetime


class RecommendationsPreviewOut(BaseModel):
    """Phase 6 — rule engine output without persisting a run (GET preview)."""

    items: list[RecommendationItemOut]
    rule_trace: list[RuleTraceOut]


class RecommendationBuiltinRuleOut(BaseModel):
    """Built-in rule metadata for operators (Phase 6 — transparency, not DB-driven rules)."""

    rule_id: str
    title: str
    description: str
    inputs: list[str]


class RecommendationFeedbackCreate(BaseModel):
    client_id: uuid.UUID
    product_id: uuid.UUID
    recommendation_run_id: uuid.UUID | None = None
    rule_ids: str = Field(min_length=1, max_length=512)
    action: RecommendationFeedbackAction
    note: str | None = None


class RecommendationFeedbackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    client_id: uuid.UUID
    product_id: uuid.UUID
    recommendation_run_id: uuid.UUID | None
    rule_ids: str
    action: RecommendationFeedbackAction
    actor_user_id: uuid.UUID
    note: str | None
    created_at: datetime


class ClientAdequacyOut(BaseModel):
    traffic_light: AdequacyTrafficLight
    summary: str
    reasons: list[str]
    needs_human_review: bool
    profile_completeness_score: int
    profile_alert_codes: list[str]
    source: Literal["batch", "live"] = "live"
    computed_at: datetime | None = None
    inputs_hash: str | None = None
    rule_version: str | None = None


class ClientAdequacyReviewBrief(BaseModel):
    client_id: uuid.UUID
    full_name: str
    traffic_light: AdequacyTrafficLight
    summary: str
    needs_human_review: bool


class CampaignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    kind: CampaignKind
    description: str | None = None
    template_subject: str | None = Field(default=None, max_length=255)
    template_body: str = Field(min_length=1)
    segment_criteria: dict[str, Any] = Field(default_factory=dict)
    active: bool = True


class CampaignUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    kind: CampaignKind | None = None
    description: str | None = None
    template_subject: str | None = Field(default=None, max_length=255)
    template_body: str | None = Field(default=None, min_length=1)
    segment_criteria: dict[str, Any] | None = None
    active: bool | None = None


class CampaignOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    kind: CampaignKind
    description: str | None
    template_subject: str | None
    template_body: str
    segment_criteria: dict[str, Any]
    active: bool
    created_at: datetime
    updated_at: datetime


class CampaignSegmentRefreshIn(BaseModel):
    scheduled_at: datetime | None = None
    channel: str = Field(default="EMAIL", max_length=32)


class CampaignTouchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    campaign_id: uuid.UUID
    client_id: uuid.UUID
    scheduled_at: datetime
    status: CampaignTouchStatus
    channel: str
    sent_at: datetime | None
    notes: str | None
    created_at: datetime


class CampaignTouchPatch(BaseModel):
    status: CampaignTouchStatus | None = None
    sent_at: datetime | None = None
    notes: str | None = None


class BatchJobRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    job_type: str
    status: BatchJobStatus
    started_at: datetime
    finished_at: datetime | None
    clients_processed: int
    error_message: str | None


class AdequacyDashboardSummaryOut(BaseModel):
    total_clients: int
    snapshot_green: int
    snapshot_yellow: int
    snapshot_red: int
    clients_without_snapshot: int
    last_job: BatchJobRunOut | None = None
