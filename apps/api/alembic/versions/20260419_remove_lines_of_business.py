"""Remove lines of business catalog, client links, and product FK."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "remove_lob_016"
down_revision = "phase9_adequacy_015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("client_lines_of_business")
    op.drop_constraint(
        "fk_products_line_of_business_id_lines_of_business",
        "products",
        type_="foreignkey",
    )
    op.drop_index(op.f("ix_products_line_of_business_id"), table_name="products")
    op.drop_column("products", "line_of_business_id")
    op.drop_index(op.f("ix_lines_of_business_organization_id"), table_name="lines_of_business")
    op.drop_table("lines_of_business")


def downgrade() -> None:
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
    op.add_column(
        "products",
        sa.Column("line_of_business_id", sa.Uuid(), nullable=True),
    )
    op.create_index(
        op.f("ix_products_line_of_business_id"),
        "products",
        ["line_of_business_id"],
    )
    op.create_foreign_key(
        "fk_products_line_of_business_id_lines_of_business",
        "products",
        "lines_of_business",
        ["line_of_business_id"],
        ["id"],
        ondelete="SET NULL",
    )
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
        sa.Column("ingestion_source", sa.String(48), nullable=False),
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
