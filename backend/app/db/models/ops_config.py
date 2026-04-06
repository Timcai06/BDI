from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import Index, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models.mixins import TimestampMixin


class OpsConfig(Base, TimestampMixin):
    __tablename__ = "ops_configs"
    __table_args__ = (Index("idx_ops_configs_updated_at", "updated_at"),)

    config_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    config_payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    )
    updated_by: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
