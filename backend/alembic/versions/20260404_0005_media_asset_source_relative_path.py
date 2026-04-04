"""add source relative path to media assets

Revision ID: 20260404_0005
Revises: 20260404_0004
Create Date: 2026-04-04 18:20:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260404_0005"
down_revision = "20260404_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("media_assets", sa.Column("source_relative_path", sa.String(length=1024), nullable=True))


def downgrade() -> None:
    op.drop_column("media_assets", "source_relative_path")
