from __future__ import annotations

import io
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from PIL import Image as PILImage
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import BatchItem, Detection, InferenceResult, InferenceTask, MediaAsset
from app.models.schemas import PredictOptions

logger = logging.getLogger(__name__)


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


def execute_task(service: Any, session: Session, task: InferenceTask) -> str:
    batch_item = session.get(BatchItem, task.batch_item_id)
    if batch_item is None:
        raise AppError(
            code="BATCH_ITEM_NOT_FOUND",
            message="Task batch item does not exist.",
            status_code=404,
            details={"batch_item_id": task.batch_item_id},
        )
    media_asset = session.get(MediaAsset, batch_item.media_asset_id)
    if media_asset is None:
        raise AppError(
            code="MEDIA_ASSET_NOT_FOUND",
            message="Task media asset does not exist.",
            status_code=404,
            details={"media_asset_id": batch_item.media_asset_id},
        )

    image_path = service._resolve_storage_path(media_asset.storage_uri)
    if not image_path.exists():
        raise AppError(
            code="MEDIA_FILE_NOT_FOUND",
            message="Task media file does not exist.",
            status_code=404,
            details={"storage_uri": media_asset.storage_uri},
        )
    service._touch_task_lease(task)
    image_bytes = image_path.read_bytes()
    requested_model_version = task.requested_model_version or service._resolve_requested_model_version(
        task.model_policy
    )
    spec, runner = service.runner_manager.resolve(requested_model_version)
    task.requested_model_version = requested_model_version
    task.resolved_model_version = spec.model_version
    runtime_payload = dict(task.runtime_payload or {})
    runtime_payload["resolved_from_policy"] = {
        "model_policy": task.model_policy,
        "requested_model_version": task.requested_model_version,
        "resolved_model_version": spec.model_version,
    }
    task.runtime_payload = runtime_payload

    options = PredictOptions(
        model_version=spec.model_version,
        inference_mode=task.inference_mode,
        return_overlay=True,
    )

    raw = runner.predict(
        image_bytes=image_bytes,
        image_name=media_asset.original_filename,
        options=options,
    )
    service._touch_task_lease(task)

    secondary_raw = None
    enhanced_uri = None
    enhanced_overlay_uri = None
    enhance_meta = None

    if task.runtime_payload.get("enhance") and service.enhance_runner:
        try:
            orig_img = PILImage.open(io.BytesIO(image_bytes))
            enhanced_img = service.enhance_runner.enhance(orig_img)
            enhance_meta = service.enhance_runner.describe()

            buf = io.BytesIO()
            enhanced_img.save(buf, format="WEBP", quality=95)
            enhanced_content = buf.getvalue()
            enhanced_uri = service.store.save_enhanced(image_id=batch_item.id, content=enhanced_content)

            secondary_raw = runner.predict(
                image_bytes=enhanced_content,
                image_name=media_asset.original_filename,
                options=options,
            )

            if secondary_raw.overlay_png:
                enhanced_overlay_uri = service.store.save_enhanced_overlay(
                    image_id=batch_item.id, content=secondary_raw.overlay_png
                )
        except Exception:
            logger.warning("Enhanced inference failed but baseline result remains valid", exc_info=True)

    result_id = _new_id("res")
    result_created_at = datetime.now(timezone.utc)
    overlay_uri = None
    if raw.overlay_png:
        overlay_uri = service.store.save_overlay(image_id=result_id, content=raw.overlay_png)

    json_payload = service._build_result_json(
        result_id=result_id,
        batch_item_id=batch_item.id,
        raw=raw,
        upload_uri=media_asset.storage_uri,
        overlay_uri=overlay_uri,
        secondary_raw=secondary_raw,
        enhanced_uri=enhanced_uri,
        enhanced_overlay_uri=enhanced_overlay_uri,
        enhancement_meta=enhance_meta if secondary_raw and enhanced_uri else None,
        created_at=result_created_at,
    )
    json_uri = service.store.save_json(image_id=result_id, payload=json_payload)

    result = InferenceResult(
        id=result_id,
        task_id=task.id,
        batch_item_id=batch_item.id,
        schema_version="2.0.0",
        model_name=raw.model_name,
        model_version=raw.model_version,
        backend=raw.backend,
        inference_mode=raw.inference_mode,
        inference_ms=raw.inference_ms + (secondary_raw.inference_ms if secondary_raw else 0),
        inference_breakdown={
            "original": raw.inference_breakdown,
            "enhanced": secondary_raw.inference_breakdown if secondary_raw else None,
        },
        detection_count=len(raw.detections),
        has_masks=any(item.mask is not None for item in raw.detections),
        mask_detection_count=sum(1 for item in raw.detections if item.mask is not None),
        overlay_uri=overlay_uri,
        json_uri=json_uri,
        created_at=result_created_at,
    )
    session.add(result)
    session.flush()

    for item in raw.detections:
        session.add(
            Detection(
                id=_new_id("det"),
                result_id=result_id,
                batch_item_id=batch_item.id,
                category=item.category,
                confidence=item.confidence,
                bbox_x=item.bbox.x,
                bbox_y=item.bbox.y,
                bbox_width=item.bbox.width,
                bbox_height=item.bbox.height,
                mask_payload=item.mask.model_dump() if item.mask is not None else None,
                length_mm=item.metrics.length_mm,
                width_mm=item.metrics.width_mm,
                area_mm2=item.metrics.area_mm2,
                source_role=item.source_role,
                source_model_name=item.source_model_name,
                source_model_version=item.source_model_version,
            )
        )

    session.flush()

    try:
        with session.begin_nested():
            service._emit_auto_alerts(
                session=session,
                batch_item=batch_item,
                result_id=result_id,
                raw=raw,
            )
            session.flush()
    except Exception as exc:
        logger.warning(
            "Auto alert persistence failed but inference result remains valid: batch_item_id=%s result_id=%s error=%s",
            batch_item.id,
            result_id,
            exc,
        )

    batch_item.processing_status = "succeeded"
    batch_item.latest_task_id = task.id
    batch_item.latest_result_id = result_id
    batch_item.defect_count = len(raw.detections)
    batch_item.max_confidence = max((item.confidence for item in raw.detections), default=None)

    task.status = "succeeded"
    task.heartbeat_at = datetime.now(timezone.utc)
    task.lease_expires_at = None
    task.finished_at = datetime.now(timezone.utc)
    task.timing_payload = raw.inference_breakdown

    service._refresh_batch_aggregates(session=session, batch_id=batch_item.batch_id)
    return result_id
