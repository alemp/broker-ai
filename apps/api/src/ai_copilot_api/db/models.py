import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
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
    IngestionSource,
    InteractionType,
    OpportunityStage,
    OpportunityStatus,
    ProductCategory,
    ProductRiskLevel,
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
    lines_of_business: Mapped[list["LineOfBusiness"]] = relationship(
        "LineOfBusiness",
        back_populates="organization",
    )
    opportunities: Mapped[list["Opportunity"]] = relationship(
        "Opportunity",
        back_populates="organization",
    )
    interactions: Mapped[list["Interaction"]] = relationship(
        "Interaction",
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
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="products",
    )
    opportunities: Mapped[list["Opportunity"]] = relationship(
        "Opportunity",
        back_populates="product",
    )
    held_placements: Mapped[list["ClientHeldProduct"]] = relationship(
        "ClientHeldProduct",
        back_populates="product",
    )


class LineOfBusiness(Base):
    __tablename__ = "lines_of_business"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "code",
            name="uq_lines_of_business_org_code",
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
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="lines_of_business",
    )
    client_links: Mapped[list["ClientLineOfBusiness"]] = relationship(
        "ClientLineOfBusiness",
        back_populates="line_of_business",
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
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
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
    opportunities: Mapped[list["Opportunity"]] = relationship(
        "Opportunity",
        back_populates="client",
    )
    line_of_business_links: Mapped[list["ClientLineOfBusiness"]] = relationship(
        "ClientLineOfBusiness",
        back_populates="client",
        cascade="all, delete-orphan",
    )
    held_products: Mapped[list["ClientHeldProduct"]] = relationship(
        "ClientHeldProduct",
        back_populates="client",
        cascade="all, delete-orphan",
    )
    interactions: Mapped[list["Interaction"]] = relationship(
        "Interaction",
        back_populates="client",
        cascade="all, delete-orphan",
    )


class ClientLineOfBusiness(Base):
    __tablename__ = "client_lines_of_business"
    __table_args__ = (
        UniqueConstraint("client_id", "line_of_business_id", name="uq_client_line_of_business"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    line_of_business_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("lines_of_business.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ingestion_source: Mapped[IngestionSource] = mapped_column(
        _varchar_enum(IngestionSource),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    client: Mapped["Client"] = relationship("Client", back_populates="line_of_business_links")
    line_of_business: Mapped["LineOfBusiness"] = relationship(
        "LineOfBusiness",
        back_populates="client_links",
    )


class ClientHeldProduct(Base):
    __tablename__ = "client_held_products"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
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

    client: Mapped["Client"] = relationship("Client", back_populates="held_products")
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
    client_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
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
    client: Mapped["Client"] = relationship("Client", back_populates="opportunities")
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
    client_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
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
    client: Mapped["Client"] = relationship("Client", back_populates="interactions")
    opportunity: Mapped["Opportunity | None"] = relationship(
        "Opportunity",
        back_populates="interactions",
    )
    created_by_user: Mapped["User"] = relationship(
        "User",
        back_populates="created_interactions",
        foreign_keys=[created_by_id],
    )
