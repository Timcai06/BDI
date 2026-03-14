from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class PredictOptions(BaseModel):
    confidence: float = Field(default=0.25, ge=0, le=1)
    iou: float = Field(default=0.45, ge=0, le=1)
    inference_mode: Literal["direct", "sliced"] = "direct"
    model_version: Optional[str] = Field(default=None, min_length=1, max_length=64)
    return_overlay: bool = False


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


class ArtifactLinks(BaseModel):
    upload_path: str
    json_path: str
    overlay_path: Optional[str] = None


class PredictResponse(BaseModel):
    schema_version: str = "1.0.0"
    image_id: str
    inference_ms: int = Field(ge=0)
    model_name: str
    model_version: str
    backend: str
    inference_mode: str
    detections: list[Detection]
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
    detection_count: int = Field(ge=0)
    categories: list[str] = Field(default_factory=list)
    artifacts: ArtifactLinks


class ResultListResponse(BaseModel):
    items: list[ResultSummary]


class DeleteResultResponse(BaseModel):
    deleted: bool = True
    image_id: str


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str
    version: str
    ready: bool
    active_runner: str
    storage_root: str


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


class RawDetection(BaseModel):
    category: str
    confidence: float
    bbox: BoundingBox
    mask: Optional[MaskPayload] = None
    metrics: DetectionMetrics = Field(default_factory=DetectionMetrics)


class RawPrediction(BaseModel):
    model_name: str
    model_version: str
    backend: str
    inference_mode: str
    inference_ms: int
    detections: list[RawDetection]
    metadata: dict[str, Any] = Field(default_factory=dict)
    overlay_png: Optional[bytes] = None
