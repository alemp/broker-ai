"""PRODUCT §5.6–5.9 — insurer catalog, product depth, recommendations, adequacy, campaigns

Revision ID: modules_56_59_012
Revises: opp_product54_011
Create Date: 2026-04-13

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "modules_56_59_012"
down_revision: str | Sequence[str] | None = "opp_product54_011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "insurers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "code", name="uq_insurers_org_code"),
    )
    op.create_index(op.f("ix_insurers_organization_id"), "insurers", ["organization_id"], unique=False)

    op.add_column("clients", sa.Column("marketing_opt_in", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column(
        "clients",
        sa.Column("preferred_marketing_channel", sa.String(length=64), nullable=True),
    )

    op.add_column("products", sa.Column("insurer_id", sa.Uuid(), nullable=True))
    op.add_column("products", sa.Column("line_of_business_id", sa.Uuid(), nullable=True))
    op.add_column("products", sa.Column("main_coverage_summary", sa.Text(), nullable=True))
    op.add_column(
        "products",
        sa.Column("additional_coverages", JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    op.add_column("products", sa.Column("exclusions_notes", sa.Text(), nullable=True))
    op.add_column("products", sa.Column("recommended_profile_summary", sa.Text(), nullable=True))
    op.add_column("products", sa.Column("commercial_arguments", sa.Text(), nullable=True))
    op.add_column(
        "products",
        sa.Column("support_materials", JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    op.create_foreign_key(
        "fk_products_insurer_id_insurers",
        "products",
        "insurers",
        ["insurer_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_products_line_of_business_id_lines_of_business",
        "products",
        "lines_of_business",
        ["line_of_business_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_products_insurer_id"), "products", ["insurer_id"], unique=False)
    op.create_index(op.f("ix_products_line_of_business_id"), "products", ["line_of_business_id"], unique=False)

    op.create_table(
        "recommendation_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.Column("opportunity_id", sa.Uuid(), nullable=True),
        sa.Column("created_by_id", sa.Uuid(), nullable=False),
        sa.Column("items", JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("rule_trace", JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["opportunity_id"], ["opportunities.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_recommendation_runs_organization_id"),
        "recommendation_runs",
        ["organization_id"],
        unique=False,
    )
    op.create_index(op.f("ix_recommendation_runs_client_id"), "recommendation_runs", ["client_id"], unique=False)

    op.create_table(
        "recommendation_feedback",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("recommendation_run_id", sa.Uuid(), nullable=True),
        sa.Column("rule_ids", sa.String(length=512), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recommendation_run_id"], ["recommendation_runs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_recommendation_feedback_organization_id"),
        "recommendation_feedback",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_recommendation_feedback_client_id"),
        "recommendation_feedback",
        ["client_id"],
        unique=False,
    )

    op.create_table(
        "campaigns",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("template_subject", sa.String(length=255), nullable=True),
        sa.Column("template_body", sa.Text(), nullable=False),
        sa.Column("segment_criteria", JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
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
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_campaigns_organization_id"), "campaigns", ["organization_id"], unique=False)

    op.create_table(
        "campaign_touches",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("campaign_id", sa.Uuid(), nullable=False),
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status",
            sa.String(length=32),
            nullable=False,
            server_default=sa.text("'PENDING'"),
        ),
        sa.Column(
            "channel",
            sa.String(length=32),
            nullable=False,
            server_default=sa.text("'EMAIL'"),
        ),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_campaign_touches_campaign_id"), "campaign_touches", ["campaign_id"], unique=False)
    op.create_index(op.f("ix_campaign_touches_client_id"), "campaign_touches", ["client_id"], unique=False)
    op.create_index(op.f("ix_campaign_touches_scheduled_at"), "campaign_touches", ["scheduled_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_campaign_touches_scheduled_at"), table_name="campaign_touches")
    op.drop_index(op.f("ix_campaign_touches_client_id"), table_name="campaign_touches")
    op.drop_index(op.f("ix_campaign_touches_campaign_id"), table_name="campaign_touches")
    op.drop_table("campaign_touches")
    op.drop_index(op.f("ix_campaigns_organization_id"), table_name="campaigns")
    op.drop_table("campaigns")
    op.drop_index(op.f("ix_recommendation_feedback_client_id"), table_name="recommendation_feedback")
    op.drop_index(op.f("ix_recommendation_feedback_organization_id"), table_name="recommendation_feedback")
    op.drop_table("recommendation_feedback")
    op.drop_index(op.f("ix_recommendation_runs_client_id"), table_name="recommendation_runs")
    op.drop_index(op.f("ix_recommendation_runs_organization_id"), table_name="recommendation_runs")
    op.drop_table("recommendation_runs")
    op.drop_index(op.f("ix_products_line_of_business_id"), table_name="products")
    op.drop_index(op.f("ix_products_insurer_id"), table_name="products")
    op.drop_constraint("fk_products_line_of_business_id_lines_of_business", "products", type_="foreignkey")
    op.drop_constraint("fk_products_insurer_id_insurers", "products", type_="foreignkey")
    op.drop_column("products", "support_materials")
    op.drop_column("products", "commercial_arguments")
    op.drop_column("products", "recommended_profile_summary")
    op.drop_column("products", "exclusions_notes")
    op.drop_column("products", "additional_coverages")
    op.drop_column("products", "main_coverage_summary")
    op.drop_column("products", "line_of_business_id")
    op.drop_column("products", "insurer_id")
    op.drop_column("clients", "preferred_marketing_channel")
    op.drop_column("clients", "marketing_opt_in")
    op.drop_index(op.f("ix_insurers_organization_id"), table_name="insurers")
    op.drop_table("insurers")
