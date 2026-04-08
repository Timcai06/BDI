from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.models.common import ArtifactLinks, Detection, EnhancementInfo


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
    secondary_result: Optional["PredictResponse"] = None
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


class DiagnosisResponse(BaseModel):
    image_id: str
    exists: bool
    content: Optional[str] = None
    generated_at: Optional[datetime] = None


class ResultEnhanceRequest(BaseModel):
    requested_by: str = Field(min_length=1, max_length=128)
    reason: Optional[str] = Field(default=None, max_length=512)
