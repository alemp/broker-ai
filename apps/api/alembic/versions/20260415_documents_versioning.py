"""Documents versioning: single Document row + DocumentVersion history

Revision ID: documents_versioning_025
Revises: documents_allow_duplicates_024
Create Date: 2026-04-15

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "documents_versioning_025"
down_revision: str | Sequence[str] | None = "documents_allow_duplicates_024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Documents: add current_version + updated_at.
    op.add_column(
        "documents",
        sa.Column("current_version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "documents",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # Document versions.
    op.create_table(
        "document_versions",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "document_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "organization_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "uploaded_by_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("content_type", sa.String(length=128), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("storage_key", sa.String(length=1024), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("document_id", "version", name="uq_document_versions_doc_version"),
    )
    op.create_index("ix_document_versions_document_id", "document_versions", ["document_id"])
    op.create_index("ix_document_versions_organization_id", "document_versions", ["organization_id"])
    op.create_index("ix_document_versions_uploaded_by_id", "document_versions", ["uploaded_by_id"])
    op.create_index("ix_document_versions_doc_created_at", "document_versions", ["document_id", "created_at"])

    # Backfill: if documents already have duplicates (from prior "allow duplicates"),
    # consolidate them into versions and keep a single canonical Document row.
    #
    # - Version numbers are assigned by created_at ascending within the logical document key.
    # - The canonical Document row is the most recent (created_at desc) in each group.
    op.execute(
        """
        WITH ranked AS (
            SELECT
                d.*,
                ROW_NUMBER() OVER (
                    PARTITION BY d.organization_id, d.document_type, d.product_id, d.original_filename
                    ORDER BY d.created_at ASC, d.id ASC
                ) AS vnum,
                ROW_NUMBER() OVER (
                    PARTITION BY d.organization_id, d.document_type, d.product_id, d.original_filename
                    ORDER BY d.created_at DESC, d.id DESC
                ) AS canon_rank
            FROM documents d
        ),
        canon AS (
            SELECT
                organization_id, document_type, product_id, original_filename,
                id AS canonical_id
            FROM ranked
            WHERE canon_rank = 1
        )
        INSERT INTO document_versions (
            id, document_id, organization_id, uploaded_by_id,
            version, content_type, size_bytes, sha256, storage_key, created_at
        )
        SELECT
            gen_random_uuid(),
            c.canonical_id,
            r.organization_id,
            r.uploaded_by_id,
            r.vnum,
            r.content_type,
            r.size_bytes,
            r.sha256,
            r.storage_key,
            r.created_at
        FROM ranked r
        JOIN canon c
          ON c.organization_id = r.organization_id
         AND c.document_type = r.document_type
         AND (c.product_id IS NOT DISTINCT FROM r.product_id)
         AND c.original_filename = r.original_filename
        """,
    )

    # Update canonical documents to reflect latest values and version number.
    op.execute(
        """
        WITH ranked AS (
            SELECT
                d.*,
                ROW_NUMBER() OVER (
                    PARTITION BY d.organization_id, d.document_type, d.product_id, d.original_filename
                    ORDER BY d.created_at DESC, d.id DESC
                ) AS canon_rank,
                COUNT(*) OVER (
                    PARTITION BY d.organization_id, d.document_type, d.product_id, d.original_filename
                ) AS cnt
            FROM documents d
        ),
        canon AS (
            SELECT * FROM ranked WHERE canon_rank = 1
        )
        UPDATE documents d
        SET
            current_version = c.cnt,
            updated_at = c.created_at,
            uploaded_by_id = c.uploaded_by_id,
            content_type = c.content_type,
            size_bytes = c.size_bytes,
            sha256 = c.sha256,
            storage_key = c.storage_key
        FROM canon c
        WHERE d.id = c.id
        """,
    )

    # Delete non-canonical duplicates.
    op.execute(
        """
        WITH ranked AS (
            SELECT
                d.id,
                ROW_NUMBER() OVER (
                    PARTITION BY d.organization_id, d.document_type, d.product_id, d.original_filename
                    ORDER BY d.created_at DESC, d.id DESC
                ) AS canon_rank
            FROM documents d
        )
        DELETE FROM documents d
        USING ranked r
        WHERE d.id = r.id AND r.canon_rank > 1
        """,
    )

    # Ensure updated_at is aligned for any remaining rows.
    op.execute("UPDATE documents SET updated_at = created_at WHERE updated_at IS NULL")

    op.create_unique_constraint(
        "uq_documents_org_type_product_filename",
        "documents",
        ["organization_id", "document_type", "product_id", "original_filename"],
    )


def downgrade() -> None:
    op.drop_index("ix_document_versions_doc_created_at", table_name="document_versions")
    op.drop_index("ix_document_versions_uploaded_by_id", table_name="document_versions")
    op.drop_index("ix_document_versions_organization_id", table_name="document_versions")
    op.drop_index("ix_document_versions_document_id", table_name="document_versions")
    op.drop_table("document_versions")

    op.drop_constraint("uq_documents_org_type_product_filename", "documents", type_="unique")
    op.drop_column("documents", "updated_at")
    op.drop_column("documents", "current_version")

