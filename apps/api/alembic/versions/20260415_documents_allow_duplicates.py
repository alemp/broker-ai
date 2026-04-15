"""Allow duplicate document uploads (keep history) by dropping org+sha unique constraint

Revision ID: documents_allow_duplicates_024
Revises: batch_job_meta_023
Create Date: 2026-04-15

"""

from collections.abc import Sequence

from alembic import op

revision: str = "documents_allow_duplicates_024"
down_revision: str | Sequence[str] | None = "batch_job_meta_023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("uq_documents_org_sha256", "documents", type_="unique")
    op.create_index("ix_documents_org_sha256", "documents", ["organization_id", "sha256"])


def downgrade() -> None:
    op.drop_index("ix_documents_org_sha256", table_name="documents")
    op.create_unique_constraint("uq_documents_org_sha256", "documents", ["organization_id", "sha256"])

