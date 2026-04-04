"""ops audit logs

Revision ID: 20260404_0004
Revises: 20260404_0003
Create Date: 2026-04-04 17:05:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260404_0004"
down_revision = "20260404_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ops_audit_logs",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("audit_type", sa.String(length=64), nullable=False),
        sa.Column("actor", sa.String(length=128), nullable=False),
        sa.Column("target_key", sa.String(length=128), nullable=True),
        sa.Column(
            "before_payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "after_payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "diff_payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_ops_audit_logs_created_at", "ops_audit_logs", ["created_at"])
    op.create_index("idx_ops_audit_logs_actor", "ops_audit_logs", ["actor"])
    op.create_index("idx_ops_audit_logs_audit_type", "ops_audit_logs", ["audit_type"])


def downgrade() -> None:
    op.drop_index("idx_ops_audit_logs_audit_type", table_name="ops_audit_logs")
    op.drop_index("idx_ops_audit_logs_actor", table_name="ops_audit_logs")
    op.drop_index("idx_ops_audit_logs_created_at", table_name="ops_audit_logs")
    op.drop_table("ops_audit_logs")
