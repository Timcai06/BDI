from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.category_mapper import normalize_defect_category


class AlertRulesConfigResponse(BaseModel):
    profile_name: str = "JTG-v1"
    alert_auto_enabled: bool = True
    count_threshold: int = Field(default=3, ge=1)
    category_watchlist: list[str] = Field(default_factory=lambda: ["seepage"])
    category_confidence_threshold: float = Field(default=0.8, ge=0, le=1)
    repeat_escalation_hits: int = Field(default=2, ge=2)
    sla_hours_by_level: dict[str, int] = Field(
        default_factory=lambda: {
            "low": 72,
            "medium": 48,
            "high": 24,
            "critical": 12,
        }
    )
    near_due_hours: int = Field(default=2, ge=1)
    updated_at: datetime
    updated_by: Optional[str] = None


class AlertRulesUpdateRequest(BaseModel):
    updated_by: str = Field(min_length=1, max_length=128)
    profile_name: Optional[str] = Field(default=None, min_length=1, max_length=64)
    alert_auto_enabled: Optional[bool] = None
    count_threshold: Optional[int] = Field(default=None, ge=1)
    category_watchlist: Optional[list[str]] = None
    category_confidence_threshold: Optional[float] = Field(default=None, ge=0, le=1)
    repeat_escalation_hits: Optional[int] = Field(default=None, ge=2)
    sla_hours_by_level: Optional[dict[str, int]] = None
    near_due_hours: Optional[int] = Field(default=None, ge=1)

    @field_validator("category_watchlist", mode="before")
    @classmethod
    def normalize_watchlist(cls, value: Any) -> Any:
        if value is None:
            return None
        if not isinstance(value, list):
            return value
        return [normalize_defect_category(str(item)) for item in value if str(item).strip()]


class OpsAuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    audit_type: str
    actor: str
    target_key: Optional[str] = None
    before_payload: dict[str, Any] = Field(default_factory=dict)
    after_payload: dict[str, Any] = Field(default_factory=dict)
    diff_payload: dict[str, Any] = Field(default_factory=dict)
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class OpsAuditLogListResponse(BaseModel):
    items: list[OpsAuditLogResponse]
    total: int
    limit: int
    offset: int


class ReviewCreateRequest(BaseModel):
    detection_id: str = Field(min_length=1, max_length=64)
    review_action: Literal["confirm", "reject", "edit"]
    reviewer: str = Field(min_length=1, max_length=128)
    review_note: Optional[str] = Field(default=None, max_length=2000)
    after_payload: dict[str, Any] = Field(default_factory=dict)


class ReviewRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    batch_item_id: str
    result_id: str
    detection_id: str
    review_action: str
    review_decision: str
    before_payload: dict[str, Any] = Field(default_factory=dict)
    after_payload: dict[str, Any] = Field(default_factory=dict)
    review_note: Optional[str] = None
    reviewer: str
    reviewed_at: datetime
    created_at: datetime


class ReviewListResponse(BaseModel):
    items: list[ReviewRecordResponse]
    total: int
    limit: int
    offset: int


class AlertCreateRequest(BaseModel):
    bridge_id: str = Field(min_length=1, max_length=64)
    batch_id: str = Field(min_length=1, max_length=64)
    batch_item_id: Optional[str] = Field(default=None, max_length=64)
    result_id: Optional[str] = Field(default=None, max_length=64)
    detection_id: Optional[str] = Field(default=None, max_length=64)
    event_type: Literal["category_hit", "severity_exceeded", "count_exceeded", "trend_spike"]
    alert_level: Literal["low", "medium", "high", "critical"]
    title: str = Field(min_length=1, max_length=255)
    trigger_payload: dict[str, Any] = Field(default_factory=dict)
    note: Optional[str] = Field(default=None, max_length=2000)


class AlertStatusUpdateRequest(BaseModel):
    action: Literal["acknowledge", "resolve"]
    operator: str = Field(min_length=1, max_length=128)
    note: Optional[str] = Field(default=None, max_length=2000)


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    bridge_id: str
    batch_id: str
    batch_item_id: Optional[str] = None
    result_id: Optional[str] = None
    detection_id: Optional[str] = None
    event_type: str
    alert_level: str
    status: str
    title: str
    trigger_payload: dict[str, Any] = Field(default_factory=dict)
    triggered_at: datetime
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class AlertListResponse(BaseModel):
    items: list[AlertResponse]
    total: int
    limit: int
    offset: int
