from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

from fastapi import status
from sqlalchemy import func, select

from app.core.errors import AppError
from app.services.protocols import BatchServiceLike
from app.db.models import BatchItem, Detection, InferenceResult, InferenceTask, InspectionBatch, MediaAsset
from app.models.schemas import (
    BatchItemDetailResponse,
    BatchItemListResponse,
    BatchItemResponse,
    BatchItemResultResponse,
    MediaAssetResponse,
    PredictResponse,
    ResultDetectionResponse,
)


def _build_batch_item_payload(
    *,
    batch_item: BatchItem,
    media_asset: MediaAsset,
    latest_task: Optional[InferenceTask],
) -> BatchItemResponse:
    item_payload = BatchItemResponse.model_validate(batch_item).model_dump()
    item_payload["original_filename"] = media_asset.original_filename
    item_payload["source_device"] = media_asset.source_device
    item_payload["source_relative_path"] = media_asset.source_relative_path
    item_payload["latest_task_status"] = latest_task.status if latest_task is not None else None
    item_payload["latest_task_attempt_no"] = latest_task.attempt_no if latest_task is not None else None
    item_payload["latest_failure_code"] = latest_task.failure_code if latest_task is not None else None
    item_payload["latest_failure_message"] = latest_task.failure_message if latest_task is not None else None
    item_payload["model_policy"] = latest_task.model_policy if latest_task is not None else None
    item_payload["requested_model_version"] = latest_task.requested_model_version if latest_task is not None else None
    item_payload["resolved_model_version"] = latest_task.resolved_model_version if latest_task is not None else None
    return BatchItemResponse.model_validate(item_payload)


def list_batch_items(
    service: BatchServiceLike,
    *,
    batch_id: str,
    limit: int,
    offset: int,
    relative_path_prefix: Optional[str] = None,
) -> BatchItemListResponse:
    with service.session_factory() as session:
        batch = session.get(InspectionBatch, batch_id)
        if batch is None:
            raise AppError(
                code="BATCH_NOT_FOUND",
                message="Batch does not exist.",
                status_code=status.HTTP_404_NOT_FOUND,
                details={"batch_id": batch_id},
            )

        normalized_prefix = service._normalize_relative_path(relative_path_prefix)
        count_query = (
            select(func.count())
            .select_from(BatchItem)
            .join(MediaAsset, MediaAsset.id == BatchItem.media_asset_id)
            .where(BatchItem.batch_id == batch_id)
        )
        query = (
            select(BatchItem, MediaAsset)
            .join(MediaAsset, MediaAsset.id == BatchItem.media_asset_id)
            .where(BatchItem.batch_id == batch_id)
        )
        if normalized_prefix:
            count_query = count_query.where(MediaAsset.source_relative_path.ilike(f"{normalized_prefix}%"))
            query = query.where(MediaAsset.source_relative_path.ilike(f"{normalized_prefix}%"))
        total = session.scalar(count_query) or 0
        rows = session.execute(
            query
            .outerjoin(InferenceTask, InferenceTask.id == BatchItem.latest_task_id)
            .add_columns(InferenceTask)
            .order_by(BatchItem.sequence_no.asc())
            .offset(offset)
            .limit(limit)
        ).all()
        items = [
            _build_batch_item_payload(
                batch_item=batch_item,
                media_asset=media_asset,
                latest_task=latest_task,
            )
            for batch_item, media_asset, latest_task in rows
        ]
        return BatchItemListResponse(items=items, total=total, limit=limit, offset=offset)


def get_batch_item_detail(service: BatchServiceLike, *, batch_item_id: str) -> BatchItemDetailResponse:
    with service.session_factory() as session:
        row = session.execute(
            select(BatchItem, MediaAsset)
            .join(MediaAsset, MediaAsset.id == BatchItem.media_asset_id)
            .outerjoin(InferenceTask, InferenceTask.id == BatchItem.latest_task_id)
            .add_columns(InferenceTask)
            .where(BatchItem.id == batch_item_id)
        ).first()
        if row is None:
            raise AppError(
                code="BATCH_ITEM_NOT_FOUND",
                message="Batch item does not exist.",
                status_code=status.HTTP_404_NOT_FOUND,
                details={"batch_item_id": batch_item_id},
            )
        batch_item, media_asset, latest_task = row
        item_payload = _build_batch_item_payload(
            batch_item=batch_item,
            media_asset=media_asset,
            latest_task=latest_task,
        ).model_dump()
        item_payload["media_asset"] = MediaAssetResponse.model_validate(media_asset)
        return BatchItemDetailResponse.model_validate(item_payload)


def get_batch_item_result(service: BatchServiceLike, *, batch_item_id: str) -> BatchItemResultResponse:
    with service.session_factory() as session:
        result = session.scalar(
            select(InferenceResult)
            .where(InferenceResult.batch_item_id == batch_item_id)
            .order_by(InferenceResult.created_at.desc())
            .limit(1)
        )
        if result is None:
            raise AppError(
                code="RESULT_NOT_FOUND",
                message="Result does not exist for batch item.",
                status_code=status.HTTP_404_NOT_FOUND,
                details={"batch_item_id": batch_item_id},
            )

        rows = session.scalars(
            select(Detection).where(Detection.result_id == result.id).order_by(Detection.created_at.asc())
        ).all()
        enhanced_path: Optional[str] = None
        enhanced_overlay_path: Optional[str] = None
        secondary_result: Optional[PredictResponse] = None

        if result.json_uri:
            try:
                payload = json.loads(Path(result.json_uri).read_text(encoding="utf-8"))
                artifacts = payload.get("artifacts")
                if isinstance(artifacts, dict):
                    raw_enhanced_path = artifacts.get("enhanced_path")
                    raw_enhanced_overlay_path = artifacts.get("enhanced_overlay_path")
                    if isinstance(raw_enhanced_path, str):
                        enhanced_path = raw_enhanced_path or None
                    if isinstance(raw_enhanced_overlay_path, str):
                        enhanced_overlay_path = raw_enhanced_overlay_path or None
                raw_secondary = payload.get("secondary_result")
                if isinstance(raw_secondary, dict):
                    secondary_result = PredictResponse.model_validate(raw_secondary)
            except Exception:
                secondary_result = None

        detections = [
            ResultDetectionResponse(
                id=row.id,
                category=row.category,
                confidence=row.confidence,
                severity_level=row.severity_level,
                bbox={
                    "x": row.bbox_x,
                    "y": row.bbox_y,
                    "width": row.bbox_width,
                    "height": row.bbox_height,
                },
                mask=row.mask_payload,
                metrics={
                    "length_mm": row.length_mm,
                    "width_mm": row.width_mm,
                    "area_mm2": row.area_mm2,
                },
                source_role=row.source_role,
                source_model_name=row.source_model_name,
                source_model_version=row.source_model_version,
                is_valid=row.is_valid,
            )
            for row in rows
        ]

        return BatchItemResultResponse(
            id=result.id,
            task_id=result.task_id,
            batch_item_id=result.batch_item_id,
            schema_version=result.schema_version,
            model_name=result.model_name,
            model_version=result.model_version,
            backend=result.backend,
            inference_mode=result.inference_mode,
            inference_ms=result.inference_ms,
            inference_breakdown=result.inference_breakdown or {},
            detection_count=result.detection_count,
            has_masks=result.has_masks,
            mask_detection_count=result.mask_detection_count,
            overlay_uri=result.overlay_uri,
            json_uri=result.json_uri,
            diagnosis_uri=result.diagnosis_uri,
            enhanced_path=enhanced_path,
            enhanced_overlay_path=enhanced_overlay_path,
            secondary_result=secondary_result,
            created_at=result.created_at,
            detections=detections,
        )
