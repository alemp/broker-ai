"""PRODUCT §5.2 — leads, client owner/company, insured persons, CRM audit

Revision ID: module52_006
Revises: phase4_005
Create Date: 2026-04-07

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "module52_006"
down_revision: Union[str, Sequence[str], None] = "phase4_005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "clients",
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(op.f("ix_clients_owner_id"), "clients", ["owner_id"], unique=False)
    op.create_foreign_key(
        "fk_clients_owner_id_users",
        "clients",
        "users",
        ["owner_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "clients",
        sa.Column(
            "client_kind",
            sa.String(length=48),
            server_default="INDIVIDUAL",
            nullable=False,
        ),
    )
    op.add_column("clients", sa.Column("company_legal_name", sa.String(length=255), nullable=True))
    op.add_column("clients", sa.Column("company_tax_id", sa.String(length=32), nullable=True))
    op.alter_column("clients", "client_kind", server_default=None)

    op.create_table(
        "leads",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("phone", sa.String(length=64), nullable=True),
        sa.Column("source", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=48),
            server_default="NEW",
            nullable=False,
        ),
        sa.Column("converted_client_id", postgresql.UUID(as_uuid=True), nullable=True),
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
        sa.ForeignKeyConstraint(["converted_client_id"], ["clients.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_leads_converted_client_id"), "leads", ["converted_client_id"])
    op.create_index(op.f("ix_leads_organization_id"), "leads", ["organization_id"])
    op.create_index(op.f("ix_leads_owner_id"), "leads", ["owner_id"])
    op.create_index(op.f("ix_leads_status"), "leads", ["status"])

    op.create_table(
        "insured_persons",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column(
            "relation",
            sa.String(length=48),
            server_default="HOLDER",
            nullable=False,
        ),
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
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_insured_persons_client_id"), "insured_persons", ["client_id"])
    op.create_index(op.f("ix_insured_persons_organization_id"), "insured_persons", ["organization_id"])
    op.alter_column("insured_persons", "relation", server_default=None)

    op.create_table(
        "crm_audit_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entity_type", sa.String(length=48), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(length=48), nullable=False),
        sa.Column("field_name", sa.String(length=128), nullable=True),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
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
    op.create_index(op.f("ix_crm_audit_events_entity_id"), "crm_audit_events", ["entity_id"])
    op.create_index(
        "ix_crm_audit_events_org_entity",
        "crm_audit_events",
        ["organization_id", "entity_type", "entity_id"],
    )
    op.create_index(op.f("ix_crm_audit_events_organization_id"), "crm_audit_events", ["organization_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_crm_audit_events_organization_id"), table_name="crm_audit_events")
    op.drop_index("ix_crm_audit_events_org_entity", table_name="crm_audit_events")
    op.drop_index(op.f("ix_crm_audit_events_entity_id"), table_name="crm_audit_events")
    op.drop_table("crm_audit_events")

    op.drop_index(op.f("ix_insured_persons_organization_id"), table_name="insured_persons")
    op.drop_index(op.f("ix_insured_persons_client_id"), table_name="insured_persons")
    op.drop_table("insured_persons")

    op.drop_index(op.f("ix_leads_status"), table_name="leads")
    op.drop_index(op.f("ix_leads_owner_id"), table_name="leads")
    op.drop_index(op.f("ix_leads_organization_id"), table_name="leads")
    op.drop_index(op.f("ix_leads_converted_client_id"), table_name="leads")
    op.drop_table("leads")

    op.drop_column("clients", "company_tax_id")
    op.drop_column("clients", "company_legal_name")
    op.drop_column("clients", "client_kind")
    op.drop_constraint("fk_clients_owner_id_users", "clients", type_="foreignkey")
    op.drop_index(op.f("ix_clients_owner_id"), table_name="clients")
    op.drop_column("clients", "owner_id")
