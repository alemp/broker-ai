"""Lead–client parity: client.source, insured/held optional client_id + lead_id."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "lead_client_parity_017"
down_revision = "remove_lob_016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("clients", sa.Column("source", sa.String(length=255), nullable=True))

    op.alter_column(
        "insured_persons",
        "client_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
    )
    op.add_column(
        "insured_persons",
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        op.f("ix_insured_persons_lead_id"),
        "insured_persons",
        ["lead_id"],
        unique=False,
    )
    op.create_foreign_key(
        op.f("fk_insured_persons_lead_id_leads"),
        "insured_persons",
        "leads",
        ["lead_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_check_constraint(
        "ck_insured_person_client_xor_lead",
        "insured_persons",
        sa.text("(client_id IS NOT NULL)::int + (lead_id IS NOT NULL)::int = 1"),
    )

    op.alter_column(
        "client_held_products",
        "client_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
    )
    op.add_column(
        "client_held_products",
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        op.f("ix_client_held_products_lead_id"),
        "client_held_products",
        ["lead_id"],
        unique=False,
    )
    op.create_foreign_key(
        op.f("fk_client_held_products_lead_id_leads"),
        "client_held_products",
        "leads",
        ["lead_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_check_constraint(
        "ck_client_held_product_client_xor_lead",
        "client_held_products",
        sa.text("(client_id IS NOT NULL)::int + (lead_id IS NOT NULL)::int = 1"),
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_client_held_product_client_xor_lead",
        "client_held_products",
        type_="check",
    )
    op.drop_constraint(
        op.f("fk_client_held_products_lead_id_leads"),
        "client_held_products",
        type_="foreignkey",
    )
    op.drop_index(op.f("ix_client_held_products_lead_id"), table_name="client_held_products")
    op.drop_column("client_held_products", "lead_id")
    op.alter_column(
        "client_held_products",
        "client_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
    )

    op.drop_constraint("ck_insured_person_client_xor_lead", "insured_persons", type_="check")
    op.drop_constraint(
        op.f("fk_insured_persons_lead_id_leads"),
        "insured_persons",
        type_="foreignkey",
    )
    op.drop_index(op.f("ix_insured_persons_lead_id"), table_name="insured_persons")
    op.drop_column("insured_persons", "lead_id")
    op.alter_column(
        "insured_persons",
        "client_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
    )

    op.drop_column("clients", "source")
