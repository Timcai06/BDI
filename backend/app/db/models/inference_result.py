from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class InferenceResult(Base):
    __tablename__ = "inference_results"
    __table_args__ = (
        CheckConstraint("inference_mode IN ('direct', 'sliced')", name="inference_mode"),
        Index("idx_inference_results_batch_item_id", "batch_item_id"),
        Index("idx_inference_results_model_version", "model_version"),
        Index("idx_inference_results_created_at", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    task_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("inference_tasks.id"),
        nullable=False,
        unique=True,
    )
    batch_item_id: Mapped[str] = mapped_column(String(64), ForeignKey("batch_items.id"), nullable=False)
    schema_version: Mapped[str] = mapped_column(String(32), nullable=False)
    model_name: Mapped[str] = mapped_column(String(128), nullable=False)
    model_version: Mapped[str] = mapped_column(String(64), nullable=False)
    backend: Mapped[str] = mapped_column(String(64), nullable=False)
    inference_mode: Mapped[str] = mapped_column(String(32), nullable=False)
    inference_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    inference_breakdown: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    )
    detection_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    has_masks: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    mask_detection_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    overlay_uri: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    json_uri: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    diagnosis_uri: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
