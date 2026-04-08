from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.results import PredictResponse


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
    enhancement_mode: Literal["off", "auto", "always"] = "always"


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
    enhancement_mode: Literal["off", "auto", "always"] = "always"
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
