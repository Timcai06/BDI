from __future__ import annotations

from typing import Optional

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models.mixins import TimestampMixin


class BatchItem(Base, TimestampMixin):
    __tablename__ = "batch_items"
    __table_args__ = (
        UniqueConstraint("batch_id", "sequence_no", name="batch_sequence"),
        UniqueConstraint("batch_id", "media_asset_id", name="batch_media"),
        CheckConstraint(
            "processing_status IN ('received', 'queued', 'running', 'succeeded', 'failed')",
            name="processing_status",
        ),
        CheckConstraint(
            "review_status IN ('unreviewed', 'partially_reviewed', 'reviewed')",
            name="review_status",
        ),
        CheckConstraint(
            "alert_status IN ('none', 'open', 'acknowledged', 'resolved')",
            name="alert_status",
        ),
        Index("idx_batch_items_batch_id", "batch_id"),
        Index("idx_batch_items_processing_status", "processing_status"),
        Index("idx_batch_items_review_status", "review_status"),
        Index("idx_batch_items_alert_status", "alert_status"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    batch_id: Mapped[str] = mapped_column(String(64), ForeignKey("inspection_batches.id"), nullable=False)
    media_asset_id: Mapped[str] = mapped_column(String(64), ForeignKey("media_assets.id"), nullable=False)
    sequence_no: Mapped[int] = mapped_column(nullable=False)
    processing_status: Mapped[str] = mapped_column(String(32), nullable=False)
    review_status: Mapped[str] = mapped_column(String(32), nullable=False, default="unreviewed")
    latest_task_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        ForeignKey("inference_tasks.id"),
        nullable=True,
    )
    latest_result_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        ForeignKey("inference_results.id"),
        nullable=True,
    )
    defect_count: Mapped[int] = mapped_column(nullable=False, default=0)
    max_confidence: Mapped[Optional[float]] = mapped_column(nullable=True)
    max_severity: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    alert_status: Mapped[str] = mapped_column(String(32), nullable=False, default="none")
