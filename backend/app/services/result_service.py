from __future__ import annotations

import mimetypes
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import status
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.core.errors import AppError
from app.core.utils import resolve_path
from app.db.models import BatchItem, MediaAsset
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
    def __init__(
        self,
        *,
        store: LocalArtifactStore,
        session_factory: sessionmaker[Session] | None = None,
    ) -> None:
        self.store = store
        self.session_factory = session_factory

    def list_results(self, *, limit: int = 20, offset: int = 0) -> ResultListResponse:
        payloads, total = self.store.list_results(limit=limit, offset=offset)
        items: list[ResultSummary] = []
        for payload in payloads:
            normalized = self._normalize_payload(payload)
            if normalized is None:
                continue
            try:
                items.append(self._build_summary(PredictResponse.model_validate(normalized)))
            except Exception:
                continue
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
        normalized = self._normalize_payload(payload)
        if normalized is None:
            raise AppError(
                code="RESULT_SCHEMA_INVALID",
                message="Result payload schema is invalid.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                details={"image_id": image_id},
            )
        return PredictResponse.model_validate(normalized)

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
        return self.get_upload_resource(image_id=image_id)[0]

    def get_upload_resource(self, *, image_id: str) -> tuple[Path, str | None, str]:
        payload = self.store.load_result(image_id=image_id)
        normalized = self._normalize_payload(payload) if payload is not None else None
        resolved = self._resolve_upload_resource(payload=normalized, image_id=image_id)
        if resolved is not None:
            return resolved

        raise AppError(
            code="IMAGE_NOT_FOUND",
            message="Uploaded image does not exist.",
            status_code=status.HTTP_404_NOT_FOUND,
            details={"image_id": image_id},
        )

    def get_enhanced_path(self, *, image_id: str) -> Path:
        payload = self.store.load_result(image_id=image_id)
        normalized = self._normalize_payload(payload) if payload is not None else None
        if isinstance(normalized, dict):
            artifacts = normalized.get("artifacts")
            if isinstance(artifacts, dict):
                raw_enhanced_path = artifacts.get("enhanced_path")
                if isinstance(raw_enhanced_path, str) and raw_enhanced_path:
                    resolved = self._resolve_artifact_path(raw_enhanced_path)
                    if resolved is not None:
                        return resolved

        enhanced_path = self.store.enhanced_path(image_id)
        if enhanced_path.exists():
            return enhanced_path

        raise AppError(
            code="ENHANCED_IMAGE_NOT_FOUND",
            message="Enhanced image does not exist.",
            status_code=status.HTTP_404_NOT_FOUND,
            details={"image_id": image_id},
        )

    def get_enhanced_overlay_path(self, *, image_id: str) -> Path:
        payload = self.store.load_result(image_id=image_id)
        normalized = self._normalize_payload(payload) if payload is not None else None
        if isinstance(normalized, dict):
            artifacts = normalized.get("artifacts")
            if isinstance(artifacts, dict):
                raw_enhanced_overlay_path = artifacts.get("enhanced_overlay_path")
                if isinstance(raw_enhanced_overlay_path, str) and raw_enhanced_overlay_path:
                    resolved = self._resolve_artifact_path(raw_enhanced_overlay_path)
                    if resolved is not None:
                        return resolved

        overlay_path = self.store.enhanced_overlay_path(image_id)
        if overlay_path.exists():
            return overlay_path

        raise AppError(
            code="ENHANCED_OVERLAY_NOT_FOUND",
            message="Enhanced overlay does not exist.",
            status_code=status.HTTP_404_NOT_FOUND,
            details={"image_id": image_id},
        )

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

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        filename = f"history-{asset_type}-export-{timestamp}.zip"
        return archive.getvalue(), filename, exported_count, skipped_count

    def _resolve_export_item(self, *, image_id: str, asset_type: str) -> tuple[str, str | bytes] | None:
        if asset_type == "json":
            payload = self.store.load_result(image_id=image_id)
            if payload is None:
                return None
            normalized = self._normalize_payload(payload)
            if normalized is None:
                return None
            normalized_payload = PredictResponse.model_validate(normalized).model_dump_json(indent=2)
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

    def _resolve_upload_resource_from_db(
        self,
        payload: dict[str, Any],
    ) -> tuple[Path, str | None, str] | None:
        if self.session_factory is None:
            return None

        batch_item_id = payload.get("batch_item_id")
        if not isinstance(batch_item_id, str) or not batch_item_id:
            return None

        with self.session_factory() as session:
            row = session.execute(
                select(MediaAsset.storage_uri, MediaAsset.mime_type, MediaAsset.original_filename)
                .join(BatchItem, BatchItem.media_asset_id == MediaAsset.id)
                .where(BatchItem.id == batch_item_id)
            ).first()

        if row is None:
            return None

        if len(row) >= 3:
            storage_uri, mime_type, original_filename = row[0], row[1], row[2]
        else:
            storage_uri = row[0]
            mime_type = None
            original_filename = None
        if not isinstance(storage_uri, str) or not storage_uri:
            return None

        resolved = self._resolve_artifact_path(storage_uri)
        if resolved is None:
            return None
        return (
            resolved,
            mime_type if isinstance(mime_type, str) else None,
            (original_filename if isinstance(original_filename, str) and original_filename else resolved.name),
        )

    def _resolve_upload_resource(
        self,
        *,
        payload: dict[str, Any] | None,
        image_id: str,
    ) -> tuple[Path, str | None, str] | None:
        if payload is not None:
            resolved = self._resolve_upload_resource_from_db(payload)
            if resolved is not None:
                return resolved

            artifacts = payload.get("artifacts")
            if isinstance(artifacts, dict):
                upload_uri = artifacts.get("upload_path")
                if isinstance(upload_uri, str) and upload_uri:
                    candidate = self._resolve_artifact_path(upload_uri)
                    if candidate is not None:
                        guessed_type, _ = mimetypes.guess_type(candidate.name)
                        return candidate, guessed_type, candidate.name

        fallback_path = self._resolve_artifact_path(str(self.store.upload_path(image_id)))
        if fallback_path is not None and fallback_path.exists():
            guessed_type, _ = mimetypes.guess_type(fallback_path.name)
            return fallback_path, guessed_type, fallback_path.name
        return None

    def _resolve_artifact_path(self, raw_path: str) -> Path | None:
        return resolve_path(raw_path, fallback=False)

    def _normalize_payload(self, payload: dict[str, Any]) -> dict[str, Any] | None:
        def _normalize_node(node: dict[str, Any]) -> dict[str, Any] | None:
            image_id = node.get("image_id")
            if not isinstance(image_id, str) or not image_id:
                return None

            artifacts = node.get("artifacts")
            if not isinstance(artifacts, dict):
                artifacts = {}

            upload_path = artifacts.get("upload_path")
            if not isinstance(upload_path, str):
                upload_path = ""

            json_path = artifacts.get("json_path")
            if not isinstance(json_path, str) or not json_path:
                json_path = str(self.store.result_path(image_id))

            node["artifacts"] = {
                "upload_path": upload_path,
                "json_path": json_path,
                "overlay_path": artifacts.get("overlay_path"),
                "enhanced_path": artifacts.get("enhanced_path"),
                "enhanced_overlay_path": artifacts.get("enhanced_overlay_path"),
            }

            secondary = node.get("secondary_result")
            if isinstance(secondary, dict):
                normalized_secondary = _normalize_node(secondary)
                if normalized_secondary is None:
                    node.pop("secondary_result", None)
                else:
                    node["secondary_result"] = normalized_secondary

            return node

        return _normalize_node(payload)

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
