import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import text

from ai_copilot_api.db.base import Base
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


def _varchar_enum(enum_cls: type) -> SAEnum:
    return SAEnum(enum_cls, native_enum=False, length=48)


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        unique=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    users: Mapped[list["User"]] = relationship("User", back_populates="organization")
    clients: Mapped[list["Client"]] = relationship("Client", back_populates="organization")
    products: Mapped[list["Product"]] = relationship("Product", back_populates="organization")
    opportunities: Mapped[list["Opportunity"]] = relationship(
        "Opportunity",
        back_populates="organization",
    )
    interactions: Mapped[list["Interaction"]] = relationship(
        "Interaction",
        back_populates="organization",
    )
    leads: Mapped[list["Lead"]] = relationship("Lead", back_populates="organization")
    insurers: Mapped[list["Insurer"]] = relationship("Insurer", back_populates="organization")
    campaigns: Mapped[list["Campaign"]] = relationship("Campaign", back_populates="organization")
    client_import_batches: Mapped[list["ClientImportBatch"]] = relationship(
        "ClientImportBatch",
        back_populates="organization",
    )
    batch_job_runs: Mapped[list["BatchJobRun"]] = relationship(
        "BatchJobRun",
        back_populates="organization",
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    email: Mapped[str] = mapped_column(
        String(320),
        nullable=False,
        unique=True,
        index=True,
    )
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="users",
    )
    owned_opportunities: Mapped[list["Opportunity"]] = relationship(
        "Opportunity",
        back_populates="owner",
        foreign_keys="Opportunity.owner_id",
    )
    created_interactions: Mapped[list["Interaction"]] = relationship(
        "Interaction",
        back_populates="created_by_user",
        foreign_keys="Interaction.created_by_id",
    )
    owned_clients: Mapped[list["Client"]] = relationship(
        "Client",
        back_populates="owner",
        foreign_keys="Client.owner_id",
    )
    assigned_leads: Mapped[list["Lead"]] = relationship(
        "Lead",
        back_populates="owner_user",
        foreign_keys="Lead.owner_id",
    )
    recommendation_runs: Mapped[list["RecommendationRun"]] = relationship(
        "RecommendationRun",
        back_populates="created_by_user",
        foreign_keys="RecommendationRun.created_by_id",
    )


class Insurer(Base):
    __tablename__ = "insurers"
    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="uq_insurers_org_code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="insurers",
    )
    products: Mapped[list["Product"]] = relationship("Product", back_populates="insurer")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[ProductCategory] = mapped_column(
        _varchar_enum(ProductCategory),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    risk_level: Mapped[ProductRiskLevel] = mapped_column(
        _varchar_enum(ProductRiskLevel),
        nullable=False,
    )
    target_tags: Mapped[str | None] = mapped_column(String(512), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    insurer_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("insurers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    main_coverage_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    additional_coverages: Mapped[list[Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'[]'::jsonb"),
        insert_default=list,
    )
    exclusions_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommended_profile_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    commercial_arguments: Mapped[str | None] = mapped_column(Text, nullable=True)
    support_materials: Mapped[list[Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'[]'::jsonb"),
        insert_default=list,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="products",
    )
    insurer: Mapped["Insurer | None"] = relationship("Insurer", back_populates="products")
    opportunities: Mapped[list["Opportunity"]] = relationship(
        "Opportunity",
        back_populates="product",
    )
    held_placements: Mapped[list["ClientHeldProduct"]] = relationship(
        "ClientHeldProduct",
        back_populates="product",
    )


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    external_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    client_kind: Mapped[ClientKind] = mapped_column(
        _varchar_enum(ClientKind),
        nullable=False,
        default=ClientKind.INDIVIDUAL,
        insert_default=ClientKind.INDIVIDUAL,
    )
    company_legal_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_tax_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    marketing_opt_in: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    preferred_marketing_channel: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    profile_data: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
        insert_default=dict,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="clients",
    )
    owner: Mapped["User | None"] = relationship(
        "User",
        back_populates="owned_clients",
        foreign_keys=[owner_id],
    )
    opportunities: Mapped[list["Opportunity"]] = relationship(
        "Opportunity",
        back_populates="client",
    )
    held_products: Mapped[list["ClientHeldProduct"]] = relationship(
        "ClientHeldProduct",
        back_populates="client",
        foreign_keys="ClientHeldProduct.client_id",
        cascade="all, delete-orphan",
    )
    interactions: Mapped[list["Interaction"]] = relationship(
        "Interaction",
        back_populates="client",
        cascade="all, delete-orphan",
    )
    insured_persons: Mapped[list["InsuredPerson"]] = relationship(
        "InsuredPerson",
        back_populates="client",
        foreign_keys="InsuredPerson.client_id",
        cascade="all, delete-orphan",
    )
    adequacy_snapshot: Mapped["ClientAdequacySnapshot | None"] = relationship(
        "ClientAdequacySnapshot",
        back_populates="client",
        uselist=False,
        cascade="all, delete-orphan",
    )


class ClientAdequacySnapshot(Base):
    """Batch-computed adequacy semáforo (Phase 9) — one row per client."""

    __tablename__ = "client_adequacy_snapshots"
    __table_args__ = (
        UniqueConstraint("client_id", name="uq_client_adequacy_snapshots_client"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    traffic_light: Mapped[AdequacyTrafficLight] = mapped_column(
        _varchar_enum(AdequacyTrafficLight),
        nullable=False,
    )
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    reasons: Mapped[list[Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'[]'::jsonb"),
        insert_default=list,
    )
    needs_human_review: Mapped[bool] = mapped_column(Boolean, nullable=False)
    profile_completeness_score: Mapped[int] = mapped_column(Integer, nullable=False)
    profile_alert_codes: Mapped[list[Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'[]'::jsonb"),
        insert_default=list,
    )
    inputs_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    rule_version: Mapped[str] = mapped_column(String(32), nullable=False)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    organization: Mapped["Organization"] = relationship("Organization")
    client: Mapped["Client"] = relationship("Client", back_populates="adequacy_snapshot")


class BatchJobRun(Base):
    """Recorded execution of a batch job (Phase 9)."""

    __tablename__ = "batch_job_runs"
    __table_args__ = (
        Index(
            "ix_batch_job_runs_org_type_finished",
            "organization_id",
            "job_type",
            "finished_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    job_type: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[BatchJobStatus] = mapped_column(
        _varchar_enum(BatchJobStatus),
        nullable=False,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    clients_processed: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text("0"),
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="batch_job_runs",
    )


class ClientHeldProduct(Base):
    __tablename__ = "client_held_products"
    __table_args__ = (
        CheckConstraint(
            "(client_id IS NOT NULL)::int + (lead_id IS NOT NULL)::int = 1",
            name="ck_client_held_product_client_xor_lead",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("leads.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    insurer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    policy_status: Mapped[str | None] = mapped_column(String(64), nullable=True)
    effective_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    ingestion_source: Mapped[IngestionSource] = mapped_column(
        _varchar_enum(IngestionSource),
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    client: Mapped["Client | None"] = relationship(
        "Client",
        back_populates="held_products",
        foreign_keys=[client_id],
    )
    lead: Mapped["Lead | None"] = relationship(
        "Lead",
        back_populates="held_products",
        foreign_keys=[lead_id],
    )
    product: Mapped["Product | None"] = relationship(
        "Product",
        back_populates="held_placements",
    )


class Opportunity(Base):
    __tablename__ = "opportunities"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("leads.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    estimated_value: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    closing_probability: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    stage: Mapped[OpportunityStage] = mapped_column(
        _varchar_enum(OpportunityStage),
        nullable=False,
        default=OpportunityStage.LEAD,
    )
    status: Mapped[OpportunityStatus] = mapped_column(
        _varchar_enum(OpportunityStatus),
        nullable=False,
        default=OpportunityStatus.OPEN,
    )
    source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_interaction_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    next_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_action_due_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )
    preferred_insurer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    expected_close_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )
    loss_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="opportunities",
    )
    client: Mapped["Client | None"] = relationship("Client", back_populates="opportunities")
    lead: Mapped["Lead | None"] = relationship(
        "Lead",
        back_populates="opportunities",
        foreign_keys=[lead_id],
    )
    owner: Mapped["User"] = relationship(
        "User",
        back_populates="owned_opportunities",
        foreign_keys=[owner_id],
    )
    product: Mapped["Product | None"] = relationship(
        "Product",
        back_populates="opportunities",
    )
    interactions: Mapped[list["Interaction"]] = relationship(
        "Interaction",
        back_populates="opportunity",
        cascade="all, delete-orphan",
    )


class Interaction(Base):
    __tablename__ = "interactions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("leads.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    opportunity_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("opportunities.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    interaction_type: Mapped[InteractionType] = mapped_column(
        _varchar_enum(InteractionType),
        nullable=False,
    )
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="interactions",
    )
    client: Mapped["Client | None"] = relationship("Client", back_populates="interactions")
    lead: Mapped["Lead | None"] = relationship("Lead", back_populates="interactions")
    opportunity: Mapped["Opportunity | None"] = relationship(
        "Opportunity",
        back_populates="interactions",
    )
    created_by_user: Mapped["User"] = relationship(
        "User",
        back_populates="created_interactions",
        foreign_keys=[created_by_id],
    )


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    external_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    client_kind: Mapped[ClientKind] = mapped_column(
        _varchar_enum(ClientKind),
        nullable=False,
        default=ClientKind.INDIVIDUAL,
        insert_default=ClientKind.INDIVIDUAL,
    )
    company_legal_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_tax_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    marketing_opt_in: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    preferred_marketing_channel: Mapped[str | None] = mapped_column(String(64), nullable=True)
    profile_data: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
        insert_default=dict,
    )
    status: Mapped[LeadStatus] = mapped_column(
        _varchar_enum(LeadStatus),
        nullable=False,
        default=LeadStatus.NEW,
        insert_default=LeadStatus.NEW,
    )
    converted_client_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clients.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="leads",
    )
    owner_user: Mapped["User | None"] = relationship(
        "User",
        back_populates="assigned_leads",
        foreign_keys=[owner_id],
    )
    converted_client: Mapped["Client | None"] = relationship(
        "Client",
        foreign_keys=[converted_client_id],
    )
    opportunities: Mapped[list["Opportunity"]] = relationship(
        "Opportunity",
        back_populates="lead",
        foreign_keys="Opportunity.lead_id",
    )
    interactions: Mapped[list["Interaction"]] = relationship(
        "Interaction",
        back_populates="lead",
        foreign_keys="Interaction.lead_id",
    )
    insured_persons: Mapped[list["InsuredPerson"]] = relationship(
        "InsuredPerson",
        back_populates="lead",
        foreign_keys="InsuredPerson.lead_id",
        cascade="all, delete-orphan",
    )
    held_products: Mapped[list["ClientHeldProduct"]] = relationship(
        "ClientHeldProduct",
        back_populates="lead",
        foreign_keys="ClientHeldProduct.lead_id",
        cascade="all, delete-orphan",
    )


class InsuredPerson(Base):
    __tablename__ = "insured_persons"
    __table_args__ = (
        CheckConstraint(
            "(client_id IS NOT NULL)::int + (lead_id IS NOT NULL)::int = 1",
            name="ck_insured_person_client_xor_lead",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("leads.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    relation: Mapped[InsuredRelation] = mapped_column(
        _varchar_enum(InsuredRelation),
        nullable=False,
        default=InsuredRelation.HOLDER,
        insert_default=InsuredRelation.HOLDER,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    organization: Mapped["Organization"] = relationship("Organization")
    client: Mapped["Client | None"] = relationship(
        "Client",
        back_populates="insured_persons",
        foreign_keys=[client_id],
    )
    lead: Mapped["Lead | None"] = relationship(
        "Lead",
        back_populates="insured_persons",
        foreign_keys=[lead_id],
    )


class CrmAuditEvent(Base):
    __tablename__ = "crm_audit_events"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    entity_type: Mapped[CrmEntityType] = mapped_column(
        _varchar_enum(CrmEntityType),
        nullable=False,
    )
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    action: Mapped[CrmAuditAction] = mapped_column(
        _varchar_enum(CrmAuditAction),
        nullable=False,
    )
    field_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class ClientImportBatch(Base):
    """Audit row for Phase 5 bulk client import (CSV / Excel)."""

    __tablename__ = "client_import_batches"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    source_format: Mapped[str] = mapped_column(String(16), nullable=False)
    row_count: Mapped[int] = mapped_column(Integer, nullable=False)
    inserted_count: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_count: Mapped[int] = mapped_column(Integer, nullable=False)
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="client_import_batches",
    )
    actor_user: Mapped["User"] = relationship("User")


class RecommendationRun(Base):
    __tablename__ = "recommendation_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    opportunity_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("opportunities.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    items: Mapped[list[Any]] = mapped_column(JSONB, nullable=False)
    rule_trace: Mapped[list[Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'[]'::jsonb"),
        insert_default=list,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    organization: Mapped["Organization"] = relationship("Organization")
    client: Mapped["Client"] = relationship("Client")
    opportunity: Mapped["Opportunity | None"] = relationship("Opportunity")
    created_by_user: Mapped["User"] = relationship(
        "User",
        back_populates="recommendation_runs",
        foreign_keys=[created_by_id],
    )
    feedback_rows: Mapped[list["RecommendationFeedback"]] = relationship(
        "RecommendationFeedback",
        back_populates="recommendation_run",
    )


class RecommendationFeedback(Base):
    __tablename__ = "recommendation_feedback"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
    )
    recommendation_run_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("recommendation_runs.id", ondelete="SET NULL"),
        nullable=True,
    )
    rule_ids: Mapped[str] = mapped_column(String(512), nullable=False)
    action: Mapped[RecommendationFeedbackAction] = mapped_column(
        _varchar_enum(RecommendationFeedbackAction),
        nullable=False,
    )
    actor_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    organization: Mapped["Organization"] = relationship("Organization")
    client: Mapped["Client"] = relationship("Client")
    product: Mapped["Product"] = relationship("Product")
    recommendation_run: Mapped["RecommendationRun | None"] = relationship(
        "RecommendationRun",
        back_populates="feedback_rows",
    )
    actor_user: Mapped["User"] = relationship("User", foreign_keys=[actor_user_id])


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    kind: Mapped[CampaignKind] = mapped_column(
        _varchar_enum(CampaignKind),
        nullable=False,
        default=CampaignKind.CUSTOM,
        insert_default=CampaignKind.CUSTOM,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    template_subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    template_body: Mapped[str] = mapped_column(Text, nullable=False)
    segment_criteria: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
        insert_default=dict,
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="campaigns",
    )
    touches: Mapped[list["CampaignTouch"]] = relationship(
        "CampaignTouch",
        back_populates="campaign",
        cascade="all, delete-orphan",
    )


class CampaignTouch(Base):
    __tablename__ = "campaign_touches"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scheduled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    status: Mapped[CampaignTouchStatus] = mapped_column(
        _varchar_enum(CampaignTouchStatus),
        nullable=False,
        default=CampaignTouchStatus.PENDING,
        insert_default=CampaignTouchStatus.PENDING,
    )
    channel: Mapped[str] = mapped_column(String(32), nullable=False, default="EMAIL")
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="touches")
    client: Mapped["Client"] = relationship("Client")
