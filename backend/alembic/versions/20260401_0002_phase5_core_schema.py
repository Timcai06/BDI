"""phase5 core schema

Revision ID: 20260401_0002
Revises: 20260401_0001
Create Date: 2026-04-01 20:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260401_0002"
down_revision = "20260401_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bridges",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("bridge_code", sa.String(length=128), nullable=False, unique=True),
        sa.Column("bridge_name", sa.String(length=255), nullable=False),
        sa.Column("bridge_type", sa.String(length=64), nullable=True),
        sa.Column("region", sa.String(length=255), nullable=True),
        sa.Column("manager_org", sa.String(length=255), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('active', 'inactive')", name="ck_bridges_status"),
    )
    op.create_index("idx_bridges_region", "bridges", ["region"])
    op.create_index("idx_bridges_manager_org", "bridges", ["manager_org"])

    op.create_table(
        "inspection_batches",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("bridge_id", sa.String(length=64), sa.ForeignKey("bridges.id"), nullable=False),
        sa.Column("batch_code", sa.String(length=128), nullable=False, unique=True),
        sa.Column("source_type", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("sealed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("sealed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expected_item_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("received_item_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("queued_item_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("running_item_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("succeeded_item_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_item_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by", sa.String(length=64), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "status IN ('created', 'ingesting', 'running', 'completed', 'partial_failed', 'failed', 'cancelled')",
            name="ck_inspection_batches_status",
        ),
    )
    op.create_index("idx_batches_bridge_id", "inspection_batches", ["bridge_id"])
    op.create_index("idx_batches_status", "inspection_batches", ["status"])
    op.create_index("idx_batches_created_at", "inspection_batches", ["created_at"])

    op.create_table(
        "media_assets",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("media_type", sa.String(length=32), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("storage_uri", sa.String(length=1024), nullable=False),
        sa.Column("sha256", sa.String(length=128), nullable=False),
        sa.Column("mime_type", sa.String(length=128), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("source_device", sa.String(length=128), nullable=True),
        sa.Column("extra_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("media_type IN ('image', 'video')", name="ck_media_assets_media_type"),
    )
    op.create_index("idx_media_assets_sha256", "media_assets", ["sha256"])
    op.create_index("idx_media_assets_uploaded_at", "media_assets", ["uploaded_at"])

    op.create_table(
        "batch_items",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("batch_id", sa.String(length=64), sa.ForeignKey("inspection_batches.id"), nullable=False),
        sa.Column("media_asset_id", sa.String(length=64), sa.ForeignKey("media_assets.id"), nullable=False),
        sa.Column("sequence_no", sa.Integer(), nullable=False),
        sa.Column("processing_status", sa.String(length=32), nullable=False),
        sa.Column("review_status", sa.String(length=32), nullable=False, server_default="unreviewed"),
        sa.Column("latest_task_id", sa.String(length=64), nullable=True),
        sa.Column("latest_result_id", sa.String(length=64), nullable=True),
        sa.Column("defect_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_confidence", sa.Float(), nullable=True),
        sa.Column("max_severity", sa.String(length=32), nullable=True),
        sa.Column("alert_status", sa.String(length=32), nullable=False, server_default="none"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("batch_id", "sequence_no", name="uq_batch_items_batch_sequence"),
        sa.UniqueConstraint("batch_id", "media_asset_id", name="uq_batch_items_batch_media"),
        sa.CheckConstraint(
            "processing_status IN ('received', 'queued', 'running', 'succeeded', 'failed')",
            name="ck_batch_items_processing_status",
        ),
        sa.CheckConstraint("review_status IN ('unreviewed', 'reviewed')", name="ck_batch_items_review_status"),
        sa.CheckConstraint(
            "alert_status IN ('none', 'open', 'acknowledged', 'resolved')",
            name="ck_batch_items_alert_status",
        ),
    )
    op.create_index("idx_batch_items_batch_id", "batch_items", ["batch_id"])
    op.create_index("idx_batch_items_processing_status", "batch_items", ["processing_status"])
    op.create_index("idx_batch_items_review_status", "batch_items", ["review_status"])
    op.create_index("idx_batch_items_alert_status", "batch_items", ["alert_status"])

    op.create_table(
        "inference_tasks",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("batch_item_id", sa.String(length=64), sa.ForeignKey("batch_items.id"), nullable=False),
        sa.Column("task_type", sa.String(length=32), nullable=False, server_default="inference"),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("attempt_no", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("model_policy", sa.String(length=64), nullable=False),
        sa.Column("requested_model_version", sa.String(length=64), nullable=True),
        sa.Column("resolved_model_version", sa.String(length=64), nullable=True),
        sa.Column("inference_mode", sa.String(length=32), nullable=False, server_default="direct"),
        sa.Column("queued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failure_code", sa.String(length=64), nullable=True),
        sa.Column("failure_message", sa.String(length=2048), nullable=True),
        sa.Column("worker_name", sa.String(length=128), nullable=True),
        sa.Column("runtime_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("timing_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "status IN ('pending', 'queued', 'running', 'succeeded', 'failed', 'cancelled')",
            name="ck_inference_tasks_status",
        ),
        sa.CheckConstraint("inference_mode IN ('direct', 'sliced')", name="ck_inference_tasks_inference_mode"),
    )
    op.create_index("idx_inference_tasks_batch_item_id", "inference_tasks", ["batch_item_id"])
    op.create_index("idx_inference_tasks_created_at", "inference_tasks", ["created_at"])
    op.create_index(
        "idx_inference_tasks_status_priority_created",
        "inference_tasks",
        ["status", "priority", "created_at"],
    )

    op.create_table(
        "inference_results",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("task_id", sa.String(length=64), sa.ForeignKey("inference_tasks.id"), nullable=False, unique=True),
        sa.Column("batch_item_id", sa.String(length=64), sa.ForeignKey("batch_items.id"), nullable=False),
        sa.Column("schema_version", sa.String(length=32), nullable=False),
        sa.Column("model_name", sa.String(length=128), nullable=False),
        sa.Column("model_version", sa.String(length=64), nullable=False),
        sa.Column("backend", sa.String(length=64), nullable=False),
        sa.Column("inference_mode", sa.String(length=32), nullable=False),
        sa.Column("inference_ms", sa.Integer(), nullable=False),
        sa.Column("inference_breakdown", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("detection_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("has_masks", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("mask_detection_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("overlay_uri", sa.String(length=1024), nullable=True),
        sa.Column("json_uri", sa.String(length=1024), nullable=True),
        sa.Column("diagnosis_uri", sa.String(length=1024), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("inference_mode IN ('direct', 'sliced')", name="ck_inference_results_inference_mode"),
    )
    op.create_index("idx_inference_results_batch_item_id", "inference_results", ["batch_item_id"])
    op.create_index("idx_inference_results_model_version", "inference_results", ["model_version"])
    op.create_index("idx_inference_results_created_at", "inference_results", ["created_at"])

    op.create_foreign_key(
        "fk_batch_items_latest_task_id_inference_tasks",
        "batch_items",
        "inference_tasks",
        ["latest_task_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_batch_items_latest_result_id_inference_results",
        "batch_items",
        "inference_results",
        ["latest_result_id"],
        ["id"],
    )

    op.create_table(
        "detections",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("result_id", sa.String(length=64), sa.ForeignKey("inference_results.id"), nullable=False),
        sa.Column("batch_item_id", sa.String(length=64), sa.ForeignKey("batch_items.id"), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("severity_level", sa.String(length=32), nullable=True),
        sa.Column("bbox_x", sa.Float(), nullable=False),
        sa.Column("bbox_y", sa.Float(), nullable=False),
        sa.Column("bbox_width", sa.Float(), nullable=False),
        sa.Column("bbox_height", sa.Float(), nullable=False),
        sa.Column("mask_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("length_mm", sa.Float(), nullable=True),
        sa.Column("width_mm", sa.Float(), nullable=True),
        sa.Column("area_mm2", sa.Float(), nullable=True),
        sa.Column("source_role", sa.String(length=32), nullable=True),
        sa.Column("source_model_name", sa.String(length=128), nullable=True),
        sa.Column("source_model_version", sa.String(length=64), nullable=True),
        sa.Column("is_valid", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("extra_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_detections_result_id", "detections", ["result_id"])
    op.create_index("idx_detections_batch_item_id", "detections", ["batch_item_id"])
    op.create_index("idx_detections_category", "detections", ["category"])
    op.create_index("idx_detections_confidence", "detections", ["confidence"])
    op.create_index("idx_detections_area_mm2", "detections", ["area_mm2"])
    op.create_index("idx_detections_source_role", "detections", ["source_role"])
    op.create_index("idx_detections_created_at", "detections", ["created_at"])
    op.create_index(
        "idx_detections_category_confidence_created",
        "detections",
        ["category", "confidence", "created_at"],
    )

    op.create_table(
        "review_records",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("batch_item_id", sa.String(length=64), sa.ForeignKey("batch_items.id"), nullable=False),
        sa.Column("result_id", sa.String(length=64), sa.ForeignKey("inference_results.id"), nullable=False),
        sa.Column("detection_id", sa.String(length=64), sa.ForeignKey("detections.id"), nullable=False),
        sa.Column("review_action", sa.String(length=32), nullable=False),
        sa.Column("review_decision", sa.String(length=32), nullable=False),
        sa.Column("before_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("after_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("reviewer", sa.String(length=128), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("review_action IN ('confirm', 'reject', 'edit')", name="ck_review_records_review_action"),
        sa.CheckConstraint(
            "review_decision IN ('confirmed', 'rejected', 'edited')",
            name="ck_review_records_review_decision",
        ),
    )
    op.create_index("idx_review_records_detection_id", "review_records", ["detection_id"])
    op.create_index("idx_review_records_batch_item_id", "review_records", ["batch_item_id"])
    op.create_index("idx_review_records_reviewer", "review_records", ["reviewer"])
    op.create_index("idx_review_records_reviewed_at", "review_records", ["reviewed_at"])

    op.create_table(
        "alert_events",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("bridge_id", sa.String(length=64), sa.ForeignKey("bridges.id"), nullable=False),
        sa.Column("batch_id", sa.String(length=64), sa.ForeignKey("inspection_batches.id"), nullable=False),
        sa.Column("batch_item_id", sa.String(length=64), sa.ForeignKey("batch_items.id"), nullable=True),
        sa.Column("result_id", sa.String(length=64), sa.ForeignKey("inference_results.id"), nullable=True),
        sa.Column("detection_id", sa.String(length=64), sa.ForeignKey("detections.id"), nullable=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("alert_level", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("trigger_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("triggered_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("acknowledged_by", sa.String(length=128), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "event_type IN ('category_hit', 'severity_exceeded', 'count_exceeded', 'trend_spike')",
            name="ck_alert_events_event_type",
        ),
        sa.CheckConstraint("alert_level IN ('low', 'medium', 'high', 'critical')", name="ck_alert_events_alert_level"),
        sa.CheckConstraint("status IN ('open', 'acknowledged', 'resolved')", name="ck_alert_events_status"),
    )
    op.create_index("idx_alert_events_bridge_id", "alert_events", ["bridge_id"])
    op.create_index("idx_alert_events_batch_id", "alert_events", ["batch_id"])
    op.create_index("idx_alert_events_status", "alert_events", ["status"])
    op.create_index("idx_alert_events_event_type", "alert_events", ["event_type"])
    op.create_index("idx_alert_events_triggered_at", "alert_events", ["triggered_at"])



def downgrade() -> None:
    op.drop_index("idx_alert_events_triggered_at", table_name="alert_events")
    op.drop_index("idx_alert_events_event_type", table_name="alert_events")
    op.drop_index("idx_alert_events_status", table_name="alert_events")
    op.drop_index("idx_alert_events_batch_id", table_name="alert_events")
    op.drop_index("idx_alert_events_bridge_id", table_name="alert_events")
    op.drop_table("alert_events")

    op.drop_index("idx_review_records_reviewed_at", table_name="review_records")
    op.drop_index("idx_review_records_reviewer", table_name="review_records")
    op.drop_index("idx_review_records_batch_item_id", table_name="review_records")
    op.drop_index("idx_review_records_detection_id", table_name="review_records")
    op.drop_table("review_records")

    op.drop_index("idx_detections_category_confidence_created", table_name="detections")
    op.drop_index("idx_detections_created_at", table_name="detections")
    op.drop_index("idx_detections_source_role", table_name="detections")
    op.drop_index("idx_detections_area_mm2", table_name="detections")
    op.drop_index("idx_detections_confidence", table_name="detections")
    op.drop_index("idx_detections_category", table_name="detections")
    op.drop_index("idx_detections_batch_item_id", table_name="detections")
    op.drop_index("idx_detections_result_id", table_name="detections")
    op.drop_table("detections")

    op.drop_constraint("fk_batch_items_latest_result_id_inference_results", "batch_items", type_="foreignkey")
    op.drop_constraint("fk_batch_items_latest_task_id_inference_tasks", "batch_items", type_="foreignkey")

    op.drop_index("idx_inference_results_created_at", table_name="inference_results")
    op.drop_index("idx_inference_results_model_version", table_name="inference_results")
    op.drop_index("idx_inference_results_batch_item_id", table_name="inference_results")
    op.drop_table("inference_results")

    op.drop_index("idx_inference_tasks_status_priority_created", table_name="inference_tasks")
    op.drop_index("idx_inference_tasks_created_at", table_name="inference_tasks")
    op.drop_index("idx_inference_tasks_batch_item_id", table_name="inference_tasks")
    op.drop_table("inference_tasks")

    op.drop_index("idx_batch_items_alert_status", table_name="batch_items")
    op.drop_index("idx_batch_items_review_status", table_name="batch_items")
    op.drop_index("idx_batch_items_processing_status", table_name="batch_items")
    op.drop_index("idx_batch_items_batch_id", table_name="batch_items")
    op.drop_table("batch_items")

    op.drop_index("idx_media_assets_uploaded_at", table_name="media_assets")
    op.drop_index("idx_media_assets_sha256", table_name="media_assets")
    op.drop_table("media_assets")

    op.drop_index("idx_batches_created_at", table_name="inspection_batches")
    op.drop_index("idx_batches_status", table_name="inspection_batches")
    op.drop_index("idx_batches_bridge_id", table_name="inspection_batches")
    op.drop_table("inspection_batches")

    op.drop_index("idx_bridges_manager_org", table_name="bridges")
    op.drop_index("idx_bridges_region", table_name="bridges")
    op.drop_table("bridges")
