"""crm client opportunity portfolio

Revision ID: phase2_003
Revises: phase1_002
Create Date: 2026-04-05

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "phase2_003"
down_revision: Union[str, Sequence[str], None] = "phase1_002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "products",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=48), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("risk_level", sa.String(length=48), nullable=False),
        sa.Column("target_tags", sa.String(length=512), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index(op.f("ix_products_organization_id"), "products", ["organization_id"])

    op.create_table(
        "lines_of_business",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("organization_id", "code", name="uq_lines_of_business_org_code"),
    )
    op.create_index(
        op.f("ix_lines_of_business_organization_id"),
        "lines_of_business",
        ["organization_id"],
    )

    op.create_table(
        "clients",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("external_id", sa.String(length=128), nullable=True),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("phone", sa.String(length=64), nullable=True),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index(op.f("ix_clients_organization_id"), "clients", ["organization_id"])
    op.create_index(op.f("ix_clients_external_id"), "clients", ["external_id"])
    op.create_index(
        "ix_clients_org_external_id",
        "clients",
        ["organization_id", "external_id"],
        unique=True,
        postgresql_where=sa.text("external_id IS NOT NULL"),
    )
    op.create_index(
        "ix_clients_org_email",
        "clients",
        ["organization_id", "email"],
        unique=True,
        postgresql_where=sa.text("email IS NOT NULL"),
    )

    op.create_table(
        "opportunities",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("estimated_value", sa.Numeric(14, 2), nullable=True),
        sa.Column(
            "closing_probability",
            sa.SmallInteger(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "stage",
            sa.String(length=48),
            nullable=False,
            server_default=sa.text("'LEAD'"),
        ),
        sa.Column(
            "status",
            sa.String(length=48),
            nullable=False,
            server_default=sa.text("'OPEN'"),
        ),
        sa.Column("source", sa.String(length=255), nullable=True),
        sa.Column("last_interaction_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_action", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="SET NULL"),
    )
    op.create_index(
        op.f("ix_opportunities_organization_id"),
        "opportunities",
        ["organization_id"],
    )
    op.create_index(op.f("ix_opportunities_client_id"), "opportunities", ["client_id"])
    op.create_index(op.f("ix_opportunities_owner_id"), "opportunities", ["owner_id"])
    op.create_index(op.f("ix_opportunities_product_id"), "opportunities", ["product_id"])

    op.create_table(
        "client_lines_of_business",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("line_of_business_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ingestion_source", sa.String(length=48), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["line_of_business_id"],
            ["lines_of_business.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "client_id",
            "line_of_business_id",
            name="uq_client_line_of_business",
        ),
    )
    op.create_index(
        op.f("ix_client_lines_of_business_client_id"),
        "client_lines_of_business",
        ["client_id"],
    )
    op.create_index(
        op.f("ix_client_lines_of_business_line_of_business_id"),
        "client_lines_of_business",
        ["line_of_business_id"],
    )

    op.create_table(
        "client_held_products",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("insurer_name", sa.String(length=255), nullable=True),
        sa.Column("policy_status", sa.String(length=64), nullable=True),
        sa.Column("effective_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("ingestion_source", sa.String(length=48), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="SET NULL"),
    )
    op.create_index(
        op.f("ix_client_held_products_client_id"),
        "client_held_products",
        ["client_id"],
    )
    op.create_index(
        op.f("ix_client_held_products_product_id"),
        "client_held_products",
        ["product_id"],
    )

    op.execute(
        sa.text(
            """
            INSERT INTO lines_of_business (organization_id, code, name, description)
            SELECT id, 'MOTOR', 'Motor', 'Automotive line'
            FROM organizations WHERE slug = 'default' LIMIT 1
            ON CONFLICT ON CONSTRAINT uq_lines_of_business_org_code DO NOTHING
            """
        ),
    )
    op.execute(
        sa.text(
            """
            INSERT INTO lines_of_business (organization_id, code, name, description)
            SELECT id, 'LIFE', 'Life', 'Life insurance line'
            FROM organizations WHERE slug = 'default' LIMIT 1
            ON CONFLICT ON CONSTRAINT uq_lines_of_business_org_code DO NOTHING
            """
        ),
    )
    op.execute(
        sa.text(
            """
            INSERT INTO lines_of_business (organization_id, code, name, description)
            SELECT id, 'HEALTH', 'Health', 'Health insurance line'
            FROM organizations WHERE slug = 'default' LIMIT 1
            ON CONFLICT ON CONSTRAINT uq_lines_of_business_org_code DO NOTHING
            """
        ),
    )

    op.execute(
        sa.text(
            """
            INSERT INTO products (
                organization_id, name, category, description, risk_level, active
            )
            SELECT id, 'Term life baseline', 'LIFE_INSURANCE',
                'MVP catalog seed', 'MEDIUM', true
            FROM organizations WHERE slug = 'default' LIMIT 1
            """
        ),
    )
    op.execute(
        sa.text(
            """
            INSERT INTO products (
                organization_id, name, category, description, risk_level, active
            )
            SELECT id, 'Private pension plan', 'PENSION',
                'MVP catalog seed', 'LOW', true
            FROM organizations WHERE slug = 'default' LIMIT 1
            """
        ),
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_client_held_products_product_id"), table_name="client_held_products")
    op.drop_index(op.f("ix_client_held_products_client_id"), table_name="client_held_products")
    op.drop_table("client_held_products")

    op.drop_index(
        op.f("ix_client_lines_of_business_line_of_business_id"),
        table_name="client_lines_of_business",
    )
    op.drop_index(
        op.f("ix_client_lines_of_business_client_id"),
        table_name="client_lines_of_business",
    )
    op.drop_table("client_lines_of_business")

    op.drop_index(op.f("ix_opportunities_product_id"), table_name="opportunities")
    op.drop_index(op.f("ix_opportunities_owner_id"), table_name="opportunities")
    op.drop_index(op.f("ix_opportunities_client_id"), table_name="opportunities")
    op.drop_index(op.f("ix_opportunities_organization_id"), table_name="opportunities")
    op.drop_table("opportunities")

    op.drop_index("ix_clients_org_email", table_name="clients")
    op.drop_index("ix_clients_org_external_id", table_name="clients")
    op.drop_index(op.f("ix_clients_external_id"), table_name="clients")
    op.drop_index(op.f("ix_clients_organization_id"), table_name="clients")
    op.drop_table("clients")

    op.drop_index(
        op.f("ix_lines_of_business_organization_id"),
        table_name="lines_of_business",
    )
    op.drop_table("lines_of_business")

    op.drop_index(op.f("ix_products_organization_id"), table_name="products")
    op.drop_table("products")
