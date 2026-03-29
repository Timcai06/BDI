from __future__ import annotations

from datetime import datetime
from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import status

from app.core.errors import AppError
from app.models.schemas import (
    BatchDeleteResultItem,
    BatchDeleteResultsResponse,
    DeleteResultResponse,
    DiagnosisResponse,
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

    def export_results_archive(
        self,
        *,
        image_ids: list[str],
        asset_type: str,
    ) -> tuple[bytes, str, int, int]:
        archive = BytesIO()
        exported_count = 0
        skipped_count = 0

        if asset_type not in {"json", "overlay"}:
            raise AppError(
                code="EXPORT_TYPE_INVALID",
                message="Unsupported export asset type.",
                status_code=status.HTTP_400_BAD_REQUEST,
                details={"asset_type": asset_type},
            )

        with ZipFile(archive, mode="w", compression=ZIP_DEFLATED) as zip_file:
            for image_id in image_ids:
                export_item = self._resolve_export_item(image_id=image_id, asset_type=asset_type)
                if export_item is None:
                    skipped_count += 1
                    continue

                filename, content = export_item
                zip_file.writestr(filename, content)
                exported_count += 1

        if exported_count == 0:
            raise AppError(
                code="EXPORT_NOT_FOUND",
                message="No exportable artifacts found for the selected records.",
                status_code=status.HTTP_404_NOT_FOUND,
                details={
                    "asset_type": asset_type,
                    "requested": len(image_ids),
                    "skipped_count": skipped_count,
                },
            )

        timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
        filename = f"history-{asset_type}-export-{timestamp}.zip"
        return archive.getvalue(), filename, exported_count, skipped_count

    def _resolve_export_item(self, *, image_id: str, asset_type: str) -> tuple[str, str | bytes] | None:
        if asset_type == "json":
            payload = self.store.load_result(image_id=image_id)
            if payload is None:
                return None
            normalized_payload = PredictResponse.model_validate(payload).model_dump_json(indent=2)
            return f"{image_id}.json", normalized_payload

        source_path = self.store.overlay_path(image_id)
        if not source_path.exists():
            return None
        return source_path.name, source_path.read_bytes()

    def _build_summary(self, result: PredictResponse) -> ResultSummary:
        return ResultSummary(
            image_id=result.image_id,
            created_at=result.created_at,
            model_name=result.model_name,
            model_version=result.model_version,
            backend=result.backend,
            inference_mode=result.inference_mode,
            inference_ms=result.inference_ms,
            inference_breakdown=result.inference_breakdown,
            detection_count=len(result.detections),
            has_masks=result.has_masks,
            mask_detection_count=result.mask_detection_count,
            has_diagnosis=self.store.diagnosis_path(result.image_id).exists(),
            categories=sorted({item.category for item in result.detections}),
            artifacts=result.artifacts,
        )

    def get_cached_diagnosis(self, *, image_id: str) -> str | None:
        """Return the cached diagnosis markdown, or None if not yet generated."""
        return self.store.load_diagnosis(image_id=image_id)

    def save_diagnosis(self, *, image_id: str, content: str) -> str:
        """Persist a completed diagnosis to disk."""
        return self.store.save_diagnosis(image_id=image_id, content=content)

    def get_diagnosis_response(self, *, image_id: str) -> DiagnosisResponse:
        content = self.store.load_diagnosis(image_id=image_id)
        if content is None:
            return DiagnosisResponse(image_id=image_id, exists=False)

        diagnosis_path = self.store.diagnosis_path(image_id)
        generated_at = datetime.fromtimestamp(diagnosis_path.stat().st_mtime)
        return DiagnosisResponse(
            image_id=image_id,
            exists=True,
            content=content,
            generated_at=generated_at,
        )
