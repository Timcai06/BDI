from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models.mixins import TimestampMixin


class InspectionBatch(Base, TimestampMixin):
    __tablename__ = "inspection_batches"
    __table_args__ = (
        CheckConstraint(
            "status IN ('created', 'ingesting', 'running', 'completed', 'partial_failed', 'failed', 'cancelled')",
            name="status",
        ),
        Index("idx_batches_bridge_id", "bridge_id"),
        Index("idx_batches_status", "status"),
        Index("idx_batches_created_at", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    bridge_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("bridges.id"),
        nullable=False,
    )
    batch_code: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    source_type: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    sealed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sealed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    expected_item_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    received_item_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    queued_item_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    running_item_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    succeeded_item_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_item_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
