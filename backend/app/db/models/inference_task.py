from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models.mixins import TimestampMixin


class InferenceTask(Base, TimestampMixin):
    __tablename__ = "inference_tasks"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'queued', 'running', 'succeeded', 'failed', 'cancelled')",
            name="status",
        ),
        CheckConstraint("inference_mode IN ('direct', 'sliced')", name="inference_mode"),
        Index("idx_inference_tasks_batch_item_id", "batch_item_id"),
        Index("idx_inference_tasks_created_at", "created_at"),
        Index(
            "idx_inference_tasks_status_priority_created",
            "status",
            "priority",
            "created_at",
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    batch_item_id: Mapped[str] = mapped_column(String(64), ForeignKey("batch_items.id"), nullable=False)
    task_type: Mapped[str] = mapped_column(String(32), nullable=False, default="inference")
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    attempt_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    model_policy: Mapped[str] = mapped_column(String(64), nullable=False)
    requested_model_version: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    resolved_model_version: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    inference_mode: Mapped[str] = mapped_column(String(32), nullable=False, default="direct")
    queued_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    failure_code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    failure_message: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    worker_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    runtime_payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    )
    timing_payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    )
