from __future__ import annotations

from typing import Optional

from sqlalchemy import CheckConstraint, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models.mixins import TimestampMixin


class Bridge(Base, TimestampMixin):
    __tablename__ = "bridges"
    __table_args__ = (
        CheckConstraint("status IN ('active', 'inactive')", name="status"),
        Index("idx_bridges_region", "region"),
        Index("idx_bridges_manager_org", "manager_org"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    bridge_code: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    bridge_name: Mapped[str] = mapped_column(String(255), nullable=False)
    bridge_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    region: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    manager_org: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(nullable=True)
    latitude: Mapped[Optional[float]] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
