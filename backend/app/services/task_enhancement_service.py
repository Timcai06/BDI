from __future__ import annotations

import io
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import status
from PIL import Image as PILImage

from app.core.errors import AppError
from app.db.models import BatchItem, InferenceResult, MediaAsset
from app.models.schemas import PredictOptions, PredictResponse, ResultEnhanceRequest


def enhance_result(service: Any, image_id: str, payload: ResultEnhanceRequest) -> PredictResponse:
    if service.enhance_runner is None:
        raise AppError(
            code="ENHANCEMENT_UNAVAILABLE",
            message="Enhancement runtime is unavailable.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details={"image_id": image_id},
        )

    with service.session_factory() as session:
        result = session.get(InferenceResult, image_id)
        if result is None:
            raise AppError(
                code="RESULT_NOT_FOUND",
                message="Result does not exist.",
                status_code=status.HTTP_404_NOT_FOUND,
                details={"image_id": image_id},
            )

        batch_item = session.get(BatchItem, result.batch_item_id)
        if batch_item is None:
            raise AppError(
                code="BATCH_ITEM_NOT_FOUND",
                message="Batch item does not exist.",
                status_code=status.HTTP_404_NOT_FOUND,
                details={"batch_item_id": result.batch_item_id},
            )

        media_asset = session.get(MediaAsset, batch_item.media_asset_id)
        if media_asset is None:
            raise AppError(
                code="MEDIA_ASSET_NOT_FOUND",
                message="Media asset does not exist.",
                status_code=status.HTTP_404_NOT_FOUND,
                details={"media_asset_id": batch_item.media_asset_id},
            )

        image_path = service._resolve_storage_path(media_asset.storage_uri)
        if not image_path.exists():
            raise AppError(
                code="MEDIA_FILE_NOT_FOUND",
                message="Task media file does not exist.",
                status_code=status.HTTP_404_NOT_FOUND,
                details={"storage_uri": media_asset.storage_uri},
            )

        spec, runner = service.runner_manager.resolve(result.model_version)
        options = PredictOptions(
            model_version=spec.model_version,
            inference_mode=result.inference_mode,
            return_overlay=True,
        )

        image_bytes = image_path.read_bytes()
        original_img = PILImage.open(io.BytesIO(image_bytes))
        enhanced_img = service.enhance_runner.enhance(original_img)
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

        enhanced_overlay_uri = None
        if secondary_raw.overlay_png:
            enhanced_overlay_uri = service.store.save_enhanced_overlay(
                image_id=batch_item.id,
                content=secondary_raw.overlay_png,
            )

        payload_path = Path(result.json_uri) if result.json_uri else service.store.result_path(image_id)
        if not payload_path.exists():
            raise AppError(
                code="RESULT_JSON_NOT_FOUND",
                message="Result payload does not exist.",
                status_code=status.HTTP_404_NOT_FOUND,
                details={"image_id": image_id},
            )

        raw_payload = json.loads(payload_path.read_text(encoding="utf-8"))
        created_at = datetime.now(timezone.utc)
        secondary_id = f"{image_id}-enhanced"
        raw_payload.setdefault("artifacts", {})
        raw_payload["artifacts"]["enhanced_path"] = enhanced_uri
        raw_payload["artifacts"]["enhanced_overlay_path"] = enhanced_overlay_uri
        raw_payload["secondary_result"] = {
            "schema_version": raw_payload.get("schema_version", "2.0.0"),
            "image_id": secondary_id,
            "result_variant": "enhanced",
            "inference_ms": secondary_raw.inference_ms,
            "inference_breakdown": secondary_raw.inference_breakdown,
            "model_name": secondary_raw.model_name,
            "model_version": secondary_raw.model_version,
            "backend": secondary_raw.backend,
            "inference_mode": secondary_raw.inference_mode,
            "detections": [
                {
                    "id": f"{secondary_id}-{index + 1}",
                    "category": item.category,
                    "confidence": item.confidence,
                    "bbox": item.bbox.model_dump(),
                    "mask": item.mask.model_dump() if item.mask is not None else None,
                    "metrics": item.metrics.model_dump(),
                    "source_role": item.source_role,
                    "source_model_name": item.source_model_name,
                    "source_model_version": item.source_model_version,
                }
                for index, item in enumerate(secondary_raw.detections)
            ],
            "has_masks": any(item.mask is not None for item in secondary_raw.detections),
            "mask_detection_count": sum(1 for item in secondary_raw.detections if item.mask is not None),
            "enhancement_info": {
                "algorithm": enhance_meta["algorithm"],
                "pipeline": enhance_meta["pipeline"],
                "revised_weights": enhance_meta["revised_weights"],
                "bridge_weights": enhance_meta["bridge_weights"],
                "generated_at": created_at.isoformat(),
            },
            "artifacts": {
                "upload_path": enhanced_uri,
                "json_path": raw_payload.get("artifacts", {}).get("json_path", ""),
                "overlay_path": enhanced_overlay_uri,
            },
            "created_at": created_at.isoformat(),
        }
        raw_payload["enhancement_request"] = {
            "requested_by": payload.requested_by,
            "reason": payload.reason,
            "generated_at": created_at.isoformat(),
        }
        payload_path.write_text(json.dumps(raw_payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return PredictResponse.model_validate(raw_payload)
