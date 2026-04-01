from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models.mixins import TimestampMixin


class AlertEvent(Base, TimestampMixin):
    __tablename__ = "alert_events"
    __table_args__ = (
        CheckConstraint(
            "event_type IN ('category_hit', 'severity_exceeded', 'count_exceeded', 'trend_spike')",
            name="event_type",
        ),
        CheckConstraint("alert_level IN ('low', 'medium', 'high', 'critical')", name="alert_level"),
        CheckConstraint("status IN ('open', 'acknowledged', 'resolved')", name="status"),
        Index("idx_alert_events_bridge_id", "bridge_id"),
        Index("idx_alert_events_batch_id", "batch_id"),
        Index("idx_alert_events_status", "status"),
        Index("idx_alert_events_event_type", "event_type"),
        Index("idx_alert_events_triggered_at", "triggered_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    bridge_id: Mapped[str] = mapped_column(String(64), ForeignKey("bridges.id"), nullable=False)
    batch_id: Mapped[str] = mapped_column(String(64), ForeignKey("inspection_batches.id"), nullable=False)
    batch_item_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("batch_items.id"), nullable=True)
    result_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        ForeignKey("inference_results.id"),
        nullable=True,
    )
    detection_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("detections.id"), nullable=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    alert_level: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    trigger_payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    )
    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    acknowledged_by: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
