from __future__ import annotations

from pathlib import Path

from fastapi import status

from app.core.errors import AppError
from app.models.schemas import PredictResponse, ResultListResponse, ResultSummary
from app.storage.local import LocalArtifactStore


class ResultService:
    def __init__(self, *, store: LocalArtifactStore) -> None:
        self.store = store

    def list_results(self, *, limit: int = 20) -> ResultListResponse:
        payloads = self.store.list_results(limit=limit)
        items = [
            self._build_summary(PredictResponse.model_validate(payload))
            for payload in payloads
        ]
        return ResultListResponse(items=items)

    def get_result(self, *, image_id: str) -> PredictResponse:
        payload = self.store.load_result(image_id=image_id)
        if payload is None:
            raise AppError(
                code="RESULT_NOT_FOUND",
                message="Result does not exist.",
                status_code=status.HTTP_404_NOT_FOUND,
                details={"image_id": image_id},
            )
        return PredictResponse.model_validate(payload)

    def get_overlay_path(self, *, image_id: str) -> Path:
        overlay_path = self.store.overlay_path(image_id)
        if not overlay_path.exists():
            raise AppError(
                code="OVERLAY_NOT_FOUND",
                message="Overlay does not exist.",
                status_code=status.HTTP_404_NOT_FOUND,
                details={"image_id": image_id},
            )
        return overlay_path

    def _build_summary(self, result: PredictResponse) -> ResultSummary:
        return ResultSummary(
            image_id=result.image_id,
            created_at=result.created_at,
            model_name=result.model_name,
            model_version=result.model_version,
            backend=result.backend,
            inference_mode=result.inference_mode,
            inference_ms=result.inference_ms,
            detection_count=len(result.detections),
            artifacts=result.artifacts,
        )
