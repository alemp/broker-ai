"""Opportunity proposal data + insurance_line; Document.opportunity_id

Revision ID: proposal_ingest_027
Revises: org_currency_026
Create Date: 2026-05-10

Implements ADR-PROPOSAL-INGEST.md decisions D1, D3, D5:

- `Opportunity` becomes the proposal container with `insurance_line`, `quote_*`,
  `proposal_*` and a partial unique index on the quote tuple for idempotency.
- `Document` gains `opportunity_id` with `ON DELETE CASCADE` so PDF evidence is
  tied to a deal.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "proposal_ingest_027"
down_revision: str | Sequence[str] | None = "org_currency_026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1) opportunities — proposal/quote columns -------------------------------
    op.add_column(
        "opportunities",
        sa.Column("insurance_line", sa.String(length=48), nullable=True),
    )
    op.add_column(
        "opportunities",
        sa.Column("proposal_source", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "opportunities",
        sa.Column("quote_number", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "opportunities",
        sa.Column("quote_item", sa.SmallInteger(), nullable=True),
    )
    op.add_column(
        "opportunities",
        sa.Column("quote_valid_until", sa.Date(), nullable=True),
    )
    op.add_column(
        "opportunities",
        sa.Column(
            "proposal_data",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )

    # Backfill insurance_line from product.category when set; default the rest
    # to GENERAL_INSURANCE so the column can become NOT NULL.
    op.execute(
        """
        UPDATE opportunities AS o
        SET insurance_line = p.category
        FROM products AS p
        WHERE o.product_id = p.id
          AND o.insurance_line IS NULL
        """,
    )
    op.execute(
        "UPDATE opportunities SET insurance_line = 'GENERAL_INSURANCE' "
        "WHERE insurance_line IS NULL",
    )
    op.alter_column("opportunities", "insurance_line", nullable=False)

    op.create_index(
        "ix_opportunities_org_insurance_line",
        "opportunities",
        ["organization_id", "insurance_line"],
        unique=False,
    )
    op.create_index(
        "ix_opportunities_quote_number",
        "opportunities",
        ["quote_number"],
        unique=False,
    )
    op.create_index(
        "ix_opportunities_org_quote_unique",
        "opportunities",
        ["organization_id", "preferred_insurer_name", "quote_number", "quote_item"],
        unique=True,
        postgresql_where=sa.text("quote_number IS NOT NULL"),
    )
    op.create_check_constraint(
        "ck_opportunities_quote_required_fields",
        "opportunities",
        (
            "quote_number IS NULL "
            "OR (preferred_insurer_name IS NOT NULL AND quote_item IS NOT NULL "
            "AND proposal_source IS NOT NULL)"
        ),
    )

    # 2) documents.opportunity_id (cascade per ADR D3) ------------------------
    op.add_column(
        "documents",
        sa.Column("opportunity_id", sa.Uuid(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_documents_opportunity_id",
        "documents",
        "opportunities",
        ["opportunity_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "ix_documents_org_opportunity_id",
        "documents",
        ["organization_id", "opportunity_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_documents_org_opportunity_id", table_name="documents")
    op.drop_constraint("fk_documents_opportunity_id", "documents", type_="foreignkey")
    op.drop_column("documents", "opportunity_id")

    op.drop_constraint(
        "ck_opportunities_quote_required_fields",
        "opportunities",
        type_="check",
    )
    op.drop_index("ix_opportunities_org_quote_unique", table_name="opportunities")
    op.drop_index("ix_opportunities_quote_number", table_name="opportunities")
    op.drop_index("ix_opportunities_org_insurance_line", table_name="opportunities")
    op.drop_column("opportunities", "proposal_data")
    op.drop_column("opportunities", "quote_valid_until")
    op.drop_column("opportunities", "quote_item")
    op.drop_column("opportunities", "quote_number")
    op.drop_column("opportunities", "proposal_source")
    op.drop_column("opportunities", "insurance_line")
