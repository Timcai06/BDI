from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Detection(Base):
    __tablename__ = "detections"
    __table_args__ = (
        Index("idx_detections_result_id", "result_id"),
        Index("idx_detections_batch_item_id", "batch_item_id"),
        Index("idx_detections_category", "category"),
        Index("idx_detections_confidence", "confidence"),
        Index("idx_detections_area_mm2", "area_mm2"),
        Index("idx_detections_source_role", "source_role"),
        Index("idx_detections_created_at", "created_at"),
        Index(
            "idx_detections_category_confidence_created",
            "category",
            "confidence",
            "created_at",
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    result_id: Mapped[str] = mapped_column(String(64), ForeignKey("inference_results.id"), nullable=False)
    batch_item_id: Mapped[str] = mapped_column(String(64), ForeignKey("batch_items.id"), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    confidence: Mapped[float] = mapped_column(nullable=False)
    severity_level: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    bbox_x: Mapped[float] = mapped_column(nullable=False)
    bbox_y: Mapped[float] = mapped_column(nullable=False)
    bbox_width: Mapped[float] = mapped_column(nullable=False)
    bbox_height: Mapped[float] = mapped_column(nullable=False)
    mask_payload: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    length_mm: Mapped[Optional[float]] = mapped_column(nullable=True)
    width_mm: Mapped[Optional[float]] = mapped_column(nullable=True)
    area_mm2: Mapped[Optional[float]] = mapped_column(nullable=True)
    source_role: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    source_model_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    source_model_version: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    is_valid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    extra_payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
