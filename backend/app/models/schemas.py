from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from app.core.category_mapper import normalize_defect_category


class PredictOptions(BaseModel):
    confidence: float = Field(default=0.25, ge=0, le=1)
    iou: float = Field(default=0.45, ge=0, le=1)
    inference_mode: Literal["direct", "sliced"] = "direct"
    model_version: Optional[str] = Field(default=None, min_length=1, max_length=64)
    return_overlay: bool = False
    pixels_per_mm: float = Field(default=10.0, gt=0)


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

    @field_validator("category", mode="before")
    @classmethod
    def normalize_category(cls, value: Any) -> str:
        return normalize_defect_category(str(value))


class ArtifactLinks(BaseModel):
    upload_path: str
    json_path: str
    overlay_path: Optional[str] = None


class PredictResponse(BaseModel):
    schema_version: str = "1.0.0"
    image_id: str
    inference_ms: int = Field(ge=0)
    inference_breakdown: dict[str, int] = Field(default_factory=dict)
    model_name: str
    model_version: str
    backend: str
    inference_mode: str
    detections: list[Detection]
    has_masks: bool = False
    mask_detection_count: int = Field(default=0, ge=0)
    artifacts: ArtifactLinks
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
