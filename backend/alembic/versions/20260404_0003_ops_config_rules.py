"""ops config rules persistence

Revision ID: 20260404_0003
Revises: 20260401_0002
Create Date: 2026-04-04 16:40:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260404_0003"
down_revision = "20260401_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ops_configs",
        sa.Column("config_key", sa.String(length=64), primary_key=True),
        sa.Column(
            "config_payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_ops_configs_updated_at", "ops_configs", ["updated_at"])


def downgrade() -> None:
    op.drop_index("idx_ops_configs_updated_at", table_name="ops_configs")
    op.drop_table("ops_configs")
