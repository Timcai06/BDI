from __future__ import annotations

from pathlib import Path

from fastapi import status

from app.core.errors import AppError
from app.models.schemas import (
    BatchDeleteResultItem,
    BatchDeleteResultsResponse,
    DeleteResultResponse,
    PredictResponse,
    ResultListResponse,
    ResultSummary,
)
from app.storage.local import LocalArtifactStore


class ResultService:
    def __init__(self, *, store: LocalArtifactStore) -> None:
        self.store = store

    def list_results(self, *, limit: int = 20, offset: int = 0) -> ResultListResponse:
        payloads, total = self.store.list_results(limit=limit, offset=offset)
        items = [
            self._build_summary(PredictResponse.model_validate(payload))
            for payload in payloads
        ]
        return ResultListResponse(items=items, total=total, offset=offset)

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

    def get_upload_path(self, *, image_id: str) -> Path:
        upload_path = self.store.upload_path(image_id)
        if not upload_path.exists():
            raise AppError(
                code="IMAGE_NOT_FOUND",
                message="Uploaded image does not exist.",
                status_code=status.HTTP_404_NOT_FOUND,
                details={"image_id": image_id},
            )
        return upload_path

    def delete_result(self, *, image_id: str) -> DeleteResultResponse:
        if self.store.load_result(image_id=image_id) is None:
            raise AppError(
                code="RESULT_NOT_FOUND",
                message="Result does not exist.",
                status_code=status.HTTP_404_NOT_FOUND,
                details={"image_id": image_id},
            )

        self.store.delete_result_artifacts(image_id=image_id)
        return DeleteResultResponse(image_id=image_id)

    def batch_delete_results(self, *, image_ids: list[str]) -> BatchDeleteResultsResponse:
        deleted_count = 0
        failed_count = 0
        results: list[BatchDeleteResultItem] = []

        for image_id in image_ids:
            if self.store.load_result(image_id=image_id) is None:
                failed_count += 1
                results.append(
                    BatchDeleteResultItem(
                        image_id=image_id,
                        deleted=False,
                        error_code="RESULT_NOT_FOUND",
                    )
                )
                continue

            self.store.delete_result_artifacts(image_id=image_id)
            deleted_count += 1
            results.append(BatchDeleteResultItem(image_id=image_id, deleted=True))

        return BatchDeleteResultsResponse(
            requested=len(image_ids),
            deleted_count=deleted_count,
            failed_count=failed_count,
            results=results,
        )

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
            categories=sorted({item.category for item in result.detections}),
            artifacts=result.artifacts,
        )
