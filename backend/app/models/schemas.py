from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.category_mapper import normalize_defect_category


class PredictOptions(BaseModel):
    confidence: float = Field(default=0.25, ge=0, le=1)
    iou: float = Field(default=0.45, ge=0, le=1)
    inference_mode: Literal["direct", "sliced"] = "direct"
    model_version: Optional[str] = Field(default=None, min_length=1, max_length=64)
    return_overlay: bool = False
    pixels_per_mm: float = Field(default=10.0, gt=0)
    enhance: bool = True


class BoundingBox(BaseModel):
    x: float = Field(ge=0)
    y: float = Field(ge=0)
    width: float = Field(ge=0)
    height: float = Field(ge=0)


class MaskPayload(BaseModel):
    format: Literal["polygon"] = "polygon"
    points: list[list[int]] = Field(default_factory=list)


class DetectionMetrics(BaseModel):
    length_mm: Optional[float] = None
    width_mm: Optional[float] = None
    area_mm2: Optional[float] = None


class Detection(BaseModel):
    id: str
    category: str
    confidence: float = Field(ge=0, le=1)
    bbox: BoundingBox
    mask: Optional[MaskPayload] = None
    metrics: DetectionMetrics = Field(default_factory=DetectionMetrics)
    source_role: Optional[str] = None
    source_model_name: Optional[str] = None
    source_model_version: Optional[str] = None

    @field_validator("category", mode="before")
    @classmethod
    def normalize_category(cls, value: Any) -> str:
        return normalize_defect_category(str(value))


class ArtifactLinks(BaseModel):
    upload_path: str
    json_path: str
    overlay_path: Optional[str] = None
    enhanced_path: Optional[str] = None
    enhanced_overlay_path: Optional[str] = None


class EnhancementInfo(BaseModel):
    algorithm: str
    pipeline: str
    revised_weights: Optional[str] = None
    bridge_weights: Optional[str] = None
    generated_at: Optional[datetime] = None


class PredictResponse(BaseModel):
    schema_version: str = "1.0.0"
    image_id: str
    result_variant: Literal["original", "enhanced"] = "original"
    inference_ms: int = Field(ge=0)
    inference_breakdown: dict[str, int] = Field(default_factory=dict)
    model_name: str
    model_version: str
    backend: str
    inference_mode: str
    detections: list[Detection]
    has_masks: bool = False
    mask_detection_count: int = Field(default=0, ge=0)
    enhancement_info: Optional[EnhancementInfo] = None
    artifacts: ArtifactLinks
    secondary_result: Optional[PredictResponse] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ResultSummary(BaseModel):
    image_id: str
    created_at: datetime
    model_name: str
    model_version: str
    backend: str
    inference_mode: str
    inference_ms: int = Field(ge=0)
    inference_breakdown: dict[str, int] = Field(default_factory=dict)
    detection_count: int = Field(ge=0)
    has_masks: bool = False
    mask_detection_count: int = Field(default=0, ge=0)
    has_diagnosis: bool = False
    categories: list[str] = Field(default_factory=list)
    artifacts: ArtifactLinks


class ResultListResponse(BaseModel):
    items: list[ResultSummary]
    total: int
    offset: int


class DeleteResultResponse(BaseModel):
    deleted: bool = True
    image_id: str


class BatchDeleteResultsRequest(BaseModel):
    image_ids: list[str] = Field(default_factory=list, min_length=1)


class BatchDeleteResultItem(BaseModel):
    image_id: str
    deleted: bool
    error_code: Optional[str] = None


class BatchDeleteResultsResponse(BaseModel):
    requested: int = Field(ge=0)
    deleted_count: int = Field(ge=0)
    failed_count: int = Field(ge=0)
    results: list[BatchDeleteResultItem] = Field(default_factory=list)


class HealthResponse(BaseModel):
    service: str
    version: str
    ready: bool
    active_runner: str
    storage_root: str
    details: Optional[dict] = None


class ModelCatalogItem(BaseModel):
    model_name: str
    model_version: str
    backend: str
    supports_masks: bool = True
    supports_overlay: bool = True
    supports_sliced_inference: bool = False
    is_active: bool = False
    is_available: bool = True


class ModelCatalogResponse(BaseModel):
    active_version: str
    items: list[ModelCatalogItem]


class DiagnosisResponse(BaseModel):
    image_id: str
    exists: bool
    content: Optional[str] = None
    generated_at: Optional[datetime] = None


class RawDetection(BaseModel):
    category: str
    confidence: float
    bbox: BoundingBox
    mask: Optional[MaskPayload] = None
    metrics: DetectionMetrics = Field(default_factory=DetectionMetrics)
    source_role: Optional[str] = None
    source_model_name: Optional[str] = None
    source_model_version: Optional[str] = None

    @field_validator("category", mode="before")
    @classmethod
    def normalize_category(cls, value: Any) -> str:
        return normalize_defect_category(str(value))


class RawPrediction(BaseModel):
    model_name: str
    model_version: str
    backend: str
    inference_mode: str
    inference_ms: int
    inference_breakdown: dict[str, int] = Field(default_factory=dict)  # pre, model, post
    detections: list[RawDetection]
    metadata: dict[str, Any] = Field(default_factory=dict)
    overlay_png: Optional[bytes] = None


class BridgeCreateRequest(BaseModel):
    bridge_code: str = Field(min_length=1, max_length=128)
    bridge_name: str = Field(min_length=1, max_length=255)
    bridge_type: Optional[str] = Field(default=None, max_length=64)
    region: Optional[str] = Field(default=None, max_length=255)
    manager_org: Optional[str] = Field(default=None, max_length=255)
    longitude: Optional[float] = None
    latitude: Optional[float] = None


class BridgeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    bridge_code: str
    bridge_name: str
    bridge_type: Optional[str] = None
    region: Optional[str] = None
    manager_org: Optional[str] = None
    longitude: Optional[float] = None
    latitude: Optional[float] = None
    status: str
    latest_batch_id: Optional[str] = None
    latest_batch_code: Optional[str] = None
    latest_batch_status: Optional[str] = None
    latest_batch_created_at: Optional[datetime] = None
    active_batch_count: int = 0
    abnormal_batch_count: int = 0
    created_at: datetime
    updated_at: datetime


class BridgeListResponse(BaseModel):
    items: list[BridgeResponse]
    total: int
    limit: int
    offset: int


class BridgeDeleteResponse(BaseModel):
    deleted: bool = True
    bridge_id: str


class BatchCreateRequest(BaseModel):
    bridge_id: str = Field(min_length=1, max_length=64)
    batch_code: Optional[str] = Field(default=None, min_length=1, max_length=128)
    source_type: str = Field(min_length=1, max_length=64)
    expected_item_count: int = Field(default=0, ge=0)
    created_by: Optional[str] = Field(default=None, max_length=64)
    inspection_label: Optional[str] = Field(default=None, max_length=128)
    enhancement_mode: Literal["off", "auto", "always"] = "auto"


class BatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    bridge_id: str
    bridge_code: Optional[str] = None
    bridge_name: Optional[str] = None
    batch_code: str
    source_type: str
    status: str
    sealed: bool
    sealed_at: Optional[datetime] = None
    expected_item_count: int
    received_item_count: int
    queued_item_count: int
    running_item_count: int
    succeeded_item_count: int
    failed_item_count: int
    created_by: Optional[str] = None
    inspection_label: Optional[str] = None
    enhancement_mode: Literal["off", "auto", "always"] = "auto"
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class BatchCreateResponse(BatchResponse):
    pass


class BatchDeleteResponse(BaseModel):
    deleted: bool = True
    batch_id: str


class BatchListResponse(BaseModel):
    items: list[BatchResponse]
    total: int
    limit: int
    offset: int


class BatchIngestItemSuccess(BaseModel):
    batch_item_id: str
    media_asset_id: str
    original_filename: str
    source_relative_path: Optional[str] = None
    processing_status: str
    task_id: str
    model_policy: str = "fusion-default"
    requested_model_version: Optional[str] = None


class BatchIngestItemError(BaseModel):
    filename: str
    code: str
    message: str


class BatchIngestResponse(BaseModel):
    batch_id: str
    accepted_count: int
    rejected_count: int
    items: list[BatchIngestItemSuccess]
    errors: list[BatchIngestItemError]


class BatchItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    batch_id: str
    media_asset_id: str
    original_filename: Optional[str] = None
    source_device: Optional[str] = None
    source_relative_path: Optional[str] = None
    sequence_no: int
    processing_status: str
    review_status: str
    latest_task_id: Optional[str] = None
    latest_task_status: Optional[str] = None
    latest_task_attempt_no: Optional[int] = None
    latest_failure_code: Optional[str] = None
    latest_failure_message: Optional[str] = None
    model_policy: Optional[str] = None
    requested_model_version: Optional[str] = None
    resolved_model_version: Optional[str] = None
    latest_result_id: Optional[str] = None
    defect_count: int
    max_confidence: Optional[float] = None
    max_severity: Optional[str] = None
    alert_status: str
    created_at: datetime
    updated_at: datetime


class BatchItemListResponse(BaseModel):
    items: list[BatchItemResponse]
    total: int
    limit: int
    offset: int


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    batch_item_id: str
    task_type: str
    status: str
    attempt_no: int
    priority: int
    model_policy: str
    requested_model_version: Optional[str] = None
    resolved_model_version: Optional[str] = None
    inference_mode: str
    queued_at: Optional[datetime] = None
    claimed_at: Optional[datetime] = None
    heartbeat_at: Optional[datetime] = None
    lease_expires_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    failure_code: Optional[str] = None
    failure_message: Optional[str] = None
    worker_name: Optional[str] = None
    runtime_payload: dict[str, Any] = Field(default_factory=dict)
    timing_payload: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class TaskProcessResponse(BaseModel):
    processed: bool
    message: Optional[str] = None
    task_id: Optional[str] = None
    result_id: Optional[str] = None


class TaskRetryRequest(BaseModel):
    requested_by: str = Field(min_length=1, max_length=128)
    reason: Optional[str] = Field(default=None, max_length=512)


class TaskRetryResponse(BaseModel):
    old_task_id: str
    new_task_id: str
    status: str


class BatchStatsResponse(BaseModel):
    batch_id: str
    status_breakdown: dict[str, int] = Field(default_factory=dict)
    review_breakdown: dict[str, int] = Field(default_factory=dict)
    category_breakdown: dict[str, int] = Field(default_factory=dict)
    alert_breakdown: dict[str, int] = Field(default_factory=dict)


class OpsMetricsResponse(BaseModel):
    window_hours: int = Field(ge=1)
    generated_at: datetime
    total_tasks: int = Field(ge=0)
    success_rate: float = Field(ge=0, le=1)
    retry_recovery_rate: Optional[float] = Field(default=None, ge=0, le=1)
    queued_tasks: int = Field(ge=0)
    running_tasks: int = Field(ge=0)
    failed_tasks: int = Field(ge=0)
    recovered_stale_tasks: int = Field(default=0, ge=0)
    p50_queue_wait_ms: Optional[int] = Field(default=None, ge=0)
    p95_queue_wait_ms: Optional[int] = Field(default=None, ge=0)
    p50_run_ms: Optional[int] = Field(default=None, ge=0)
    p95_run_ms: Optional[int] = Field(default=None, ge=0)
    status_breakdown: dict[str, int] = Field(default_factory=dict)
    failure_code_breakdown: dict[str, int] = Field(default_factory=dict)


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


class MediaAssetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    media_type: str
    original_filename: str
    storage_uri: str
    mime_type: str
    file_size_bytes: int
    width: Optional[int] = None
    height: Optional[int] = None
    captured_at: Optional[datetime] = None
    uploaded_at: datetime
    source_device: Optional[str] = None
    source_relative_path: Optional[str] = None


class BatchItemDetailResponse(BatchItemResponse):
    media_asset: MediaAssetResponse


class ResultDetectionResponse(BaseModel):
    id: str
    category: str
    confidence: float
    severity_level: Optional[str] = None
    bbox: dict[str, float]
    mask: Optional[dict[str, Any]] = None
    metrics: dict[str, Optional[float]] = Field(default_factory=dict)
    source_role: Optional[str] = None
    source_model_name: Optional[str] = None
    source_model_version: Optional[str] = None
    is_valid: bool = True


class BatchItemResultResponse(BaseModel):
    id: str
    task_id: str
    batch_item_id: str
    schema_version: str
    model_name: str
    model_version: str
    backend: str
    inference_mode: str
    inference_ms: int
    inference_breakdown: dict[str, Any] = Field(default_factory=dict)
    detection_count: int
    has_masks: bool
    mask_detection_count: int
    overlay_uri: Optional[str] = None
    json_uri: Optional[str] = None
    diagnosis_uri: Optional[str] = None
    enhanced_path: Optional[str] = None
    enhanced_overlay_path: Optional[str] = None
    secondary_result: Optional[PredictResponse] = None
    created_at: datetime
    detections: list[ResultDetectionResponse] = Field(default_factory=list)


class DetectionRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    result_id: str
    batch_item_id: str
    category: str
    confidence: float
    severity_level: Optional[str] = None
    bbox_x: float
    bbox_y: float
    bbox_width: float
    bbox_height: float
    mask_payload: Optional[dict[str, Any]] = None
    length_mm: Optional[float] = None
    width_mm: Optional[float] = None
    area_mm2: Optional[float] = None
    source_role: Optional[str] = None
    source_model_name: Optional[str] = None
    source_model_version: Optional[str] = None
    is_valid: bool
    extra_payload: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class DetectionListResponse(BaseModel):
    items: list[DetectionRecordResponse]
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
