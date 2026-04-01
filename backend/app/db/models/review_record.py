from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ReviewRecord(Base):
    __tablename__ = "review_records"
    __table_args__ = (
        CheckConstraint("review_action IN ('confirm', 'reject', 'edit')", name="review_action"),
        CheckConstraint(
            "review_decision IN ('confirmed', 'rejected', 'edited')",
            name="review_decision",
        ),
        Index("idx_review_records_detection_id", "detection_id"),
        Index("idx_review_records_batch_item_id", "batch_item_id"),
        Index("idx_review_records_reviewer", "reviewer"),
        Index("idx_review_records_reviewed_at", "reviewed_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    batch_item_id: Mapped[str] = mapped_column(String(64), ForeignKey("batch_items.id"), nullable=False)
    result_id: Mapped[str] = mapped_column(String(64), ForeignKey("inference_results.id"), nullable=False)
    detection_id: Mapped[str] = mapped_column(String(64), ForeignKey("detections.id"), nullable=False)
    review_action: Mapped[str] = mapped_column(String(32), nullable=False)
    review_decision: Mapped[str] = mapped_column(String(32), nullable=False)
    before_payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    )
    after_payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    )
    review_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reviewer: Mapped[str] = mapped_column(String(128), nullable=False)
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
