"""task leases and partial review status

Revision ID: 20260404_0006
Revises: 20260404_0005
Create Date: 2026-04-04 21:20:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260404_0006"
down_revision = "20260404_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("inference_tasks", sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("inference_tasks", sa.Column("heartbeat_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("inference_tasks", sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(
        "idx_inference_tasks_status_lease",
        "inference_tasks",
        ["status", "lease_expires_at"],
    )
    op.create_index(
        "idx_inference_tasks_batch_item_attempt",
        "inference_tasks",
        ["batch_item_id", "attempt_no"],
    )
    op.create_index(
        "idx_inference_tasks_worker_status",
        "inference_tasks",
        ["worker_name", "status"],
    )

    op.execute("ALTER TABLE batch_items DROP CONSTRAINT IF EXISTS review_status")
    op.execute("ALTER TABLE batch_items DROP CONSTRAINT IF EXISTS ck_batch_items_review_status")
    op.create_check_constraint(
        "review_status",
        "batch_items",
        "review_status IN ('unreviewed', 'partially_reviewed', 'reviewed')",
    )


def downgrade() -> None:
    op.execute("ALTER TABLE batch_items DROP CONSTRAINT IF EXISTS review_status")
    op.execute("ALTER TABLE batch_items DROP CONSTRAINT IF EXISTS ck_batch_items_review_status")
    op.create_check_constraint(
        "review_status",
        "batch_items",
        "review_status IN ('unreviewed', 'reviewed')",
    )

    op.drop_index("idx_inference_tasks_worker_status", table_name="inference_tasks")
    op.drop_index("idx_inference_tasks_batch_item_attempt", table_name="inference_tasks")
    op.drop_index("idx_inference_tasks_status_lease", table_name="inference_tasks")
    op.drop_column("inference_tasks", "lease_expires_at")
    op.drop_column("inference_tasks", "heartbeat_at")
    op.drop_column("inference_tasks", "claimed_at")
