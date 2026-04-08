from __future__ import annotations

from datetime import datetime
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
    inference_breakdown: dict[str, int] = Field(default_factory=dict)
    detections: list[RawDetection]
    metadata: dict[str, Any] = Field(default_factory=dict)
    overlay_png: Optional[bytes] = None


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
