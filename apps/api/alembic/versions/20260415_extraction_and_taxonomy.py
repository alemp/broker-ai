"""Extraction runs + coverage taxonomy (policy adequacy extraction/normalization)

Revision ID: extraction_taxonomy_022
Revises: d469ef7f39bf
Create Date: 2026-04-15

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "extraction_taxonomy_022"
down_revision: str | Sequence[str] | None = "d469ef7f39bf"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "document_extraction_runs",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "organization_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "document_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_by_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "confirmed_by_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confidence", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("requires_review", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "extracted_data",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "normalized_data",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_document_extraction_runs_organization_id",
        "document_extraction_runs",
        ["organization_id"],
    )
    op.create_index(
        "ix_document_extraction_runs_document_id",
        "document_extraction_runs",
        ["document_id"],
    )
    op.create_index(
        "ix_document_extraction_runs_created_by_id",
        "document_extraction_runs",
        ["created_by_id"],
    )
    op.create_index(
        "ix_document_extraction_runs_confirmed_by_id",
        "document_extraction_runs",
        ["confirmed_by_id"],
    )
    op.create_index(
        "ix_doc_extract_org_created_at",
        "document_extraction_runs",
        ["organization_id", "created_at"],
    )
    op.create_index(
        "ix_doc_extract_doc_created_at",
        "document_extraction_runs",
        ["document_id", "created_at"],
    )

    op.create_table(
        "coverage_taxonomy",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "organization_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column(
            "synonyms",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("organization_id", "code", name="uq_cov_taxonomy_org_code"),
    )
    op.create_index("ix_coverage_taxonomy_organization_id", "coverage_taxonomy", ["organization_id"])
    op.create_index("ix_cov_taxonomy_org_code", "coverage_taxonomy", ["organization_id", "code"])


def downgrade() -> None:
    op.drop_index("ix_cov_taxonomy_org_code", table_name="coverage_taxonomy")
    op.drop_index("ix_coverage_taxonomy_organization_id", table_name="coverage_taxonomy")
    op.drop_table("coverage_taxonomy")

    op.drop_index("ix_doc_extract_doc_created_at", table_name="document_extraction_runs")
    op.drop_index("ix_doc_extract_org_created_at", table_name="document_extraction_runs")
    op.drop_index("ix_document_extraction_runs_confirmed_by_id", table_name="document_extraction_runs")
    op.drop_index("ix_document_extraction_runs_created_by_id", table_name="document_extraction_runs")
    op.drop_index("ix_document_extraction_runs_document_id", table_name="document_extraction_runs")
    op.drop_index("ix_document_extraction_runs_organization_id", table_name="document_extraction_runs")
    op.drop_table("document_extraction_runs")

