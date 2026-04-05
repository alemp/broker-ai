"""Lead CRM parity + opportunity client-or-lead party + interactions for leads.

Revision ID: 20260415_party
Revises: rename_auto_display_013
Create Date: 2026-04-15

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260415_party"
down_revision = "rename_auto_display_013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("leads", sa.Column("external_id", sa.String(length=128), nullable=True))
    op.create_index(op.f("ix_leads_external_id"), "leads", ["external_id"], unique=False)
    op.add_column(
        "leads",
        sa.Column(
            "client_kind",
            sa.String(length=48),
            server_default="INDIVIDUAL",
            nullable=False,
        ),
    )
    op.add_column("leads", sa.Column("company_legal_name", sa.String(length=255), nullable=True))
    op.add_column("leads", sa.Column("company_tax_id", sa.String(length=32), nullable=True))
    op.add_column(
        "leads",
        sa.Column("marketing_opt_in", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    )
    op.add_column("leads", sa.Column("preferred_marketing_channel", sa.String(length=64), nullable=True))
    op.add_column(
        "leads",
        sa.Column(
            "profile_data",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )

    op.add_column("opportunities", sa.Column("lead_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        op.f("fk_opportunities_lead_id_leads"),
        "opportunities",
        "leads",
        ["lead_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(op.f("ix_opportunities_lead_id"), "opportunities", ["lead_id"], unique=False)

    op.alter_column("opportunities", "client_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)

    op.create_check_constraint(
        "ck_opportunities_client_xor_lead",
        "opportunities",
        sa.text(
            "(client_id IS NOT NULL AND lead_id IS NULL) OR (client_id IS NULL AND lead_id IS NOT NULL)",
        ),
    )

    op.add_column("interactions", sa.Column("lead_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        op.f("fk_interactions_lead_id_leads"),
        "interactions",
        "leads",
        ["lead_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(op.f("ix_interactions_lead_id"), "interactions", ["lead_id"], unique=False)

    op.alter_column("interactions", "client_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)

    op.create_check_constraint(
        "ck_interactions_client_xor_lead",
        "interactions",
        sa.text(
            "(client_id IS NOT NULL AND lead_id IS NULL) OR (client_id IS NULL AND lead_id IS NOT NULL)",
        ),
    )


def downgrade() -> None:
    op.drop_constraint("ck_interactions_client_xor_lead", "interactions", type_="check")
    op.alter_column("interactions", "client_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)
    op.drop_index(op.f("ix_interactions_lead_id"), table_name="interactions")
    op.drop_constraint(op.f("fk_interactions_lead_id_leads"), "interactions", type_="foreignkey")
    op.drop_column("interactions", "lead_id")

    op.drop_constraint("ck_opportunities_client_xor_lead", "opportunities", type_="check")
    op.alter_column("opportunities", "client_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)
    op.drop_index(op.f("ix_opportunities_lead_id"), table_name="opportunities")
    op.drop_constraint(op.f("fk_opportunities_lead_id_leads"), "opportunities", type_="foreignkey")
    op.drop_column("opportunities", "lead_id")

    op.drop_index(op.f("ix_leads_external_id"), table_name="leads")
    op.drop_column("leads", "profile_data")
    op.drop_column("leads", "preferred_marketing_channel")
    op.drop_column("leads", "marketing_opt_in")
    op.drop_column("leads", "company_tax_id")
    op.drop_column("leads", "company_legal_name")
    op.drop_column("leads", "client_kind")
    op.drop_column("leads", "external_id")
