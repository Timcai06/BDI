from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import Index, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models.mixins import TimestampMixin


class OpsAuditLog(Base, TimestampMixin):
    __tablename__ = "ops_audit_logs"
    __table_args__ = (
        Index("idx_ops_audit_logs_created_at", "created_at"),
        Index("idx_ops_audit_logs_actor", "actor"),
        Index("idx_ops_audit_logs_audit_type", "audit_type"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    audit_type: Mapped[str] = mapped_column(String(64), nullable=False)
    actor: Mapped[str] = mapped_column(String(128), nullable=False)
    target_key: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
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
    diff_payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    )
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
