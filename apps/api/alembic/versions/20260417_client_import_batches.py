"""Phase 5 — client CSV/Excel import batch audit rows."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "phase5_import_014"
down_revision = "20260416_campaign_kind"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "client_import_batches",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("file_sha256", sa.String(length=64), nullable=False),
        sa.Column("source_format", sa.String(length=16), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("inserted_count", sa.Integer(), nullable=False),
        sa.Column("updated_count", sa.Integer(), nullable=False),
        sa.Column("error_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_client_import_batches_actor_user_id"),
        "client_import_batches",
        ["actor_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_client_import_batches_organization_id"),
        "client_import_batches",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_client_import_batches_created_at"),
        "client_import_batches",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_client_import_batches_created_at"), table_name="client_import_batches")
    op.drop_index(
        op.f("ix_client_import_batches_organization_id"),
        table_name="client_import_batches",
    )
    op.drop_index(
        op.f("ix_client_import_batches_actor_user_id"),
        table_name="client_import_batches",
    )
    op.drop_table("client_import_batches")
