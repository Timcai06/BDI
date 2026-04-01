"""phase5 baseline revision

Revision ID: 20260401_0001
Revises:
Create Date: 2026-04-01 19:30:00
"""

from __future__ import annotations

revision = "20260401_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Phase 5 starts with SQLAlchemy/Alembic scaffolding. Use a follow-up
    # autogenerate revision to materialize all tables from app.db.models.
    pass


def downgrade() -> None:
    pass
