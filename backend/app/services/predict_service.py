from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from fastapi import UploadFile, status

from app.adapters.manager import RunnerManager
from app.core.errors import AppError
from app.models.schemas import ArtifactLinks, Detection, PredictOptions, PredictResponse
from app.storage.local import LocalArtifactStore

logger = logging.getLogger(__name__)

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


class PredictService:
    def __init__(
        self,
        *,
        store: LocalArtifactStore,
        runner_manager: RunnerManager,
        max_upload_size_bytes: int,
    ) -> None:
        self.store = store
        self.runner_manager = runner_manager
        self.max_upload_size_bytes = max_upload_size_bytes

    async def predict(self, *, file: UploadFile, options: PredictOptions) -> PredictResponse:
        if not file.filename:
            raise AppError(
                code="MISSING_FILENAME",
                message="Uploaded file must include a filename.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        suffix = Path(file.filename).suffix.lower()
        if suffix not in ALLOWED_SUFFIXES:
            raise AppError(
                code="INVALID_IMAGE_FORMAT",
                message="Only jpg, jpeg, png, and webp files are supported.",
                status_code=status.HTTP_400_BAD_REQUEST,
                details={"filename": file.filename},
            )

        if file.content_type not in ALLOWED_CONTENT_TYPES:
            raise AppError(
                code="INVALID_CONTENT_TYPE",
                message="Unsupported content type for uploaded image.",
                status_code=status.HTTP_400_BAD_REQUEST,
                details={"content_type": file.content_type},
            )

        content = await file.read()
        if not content:
            raise AppError(
                code="EMPTY_FILE",
                message="Uploaded image is empty.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if len(content) > self.max_upload_size_bytes:
            max_upload_size_mb = self.max_upload_size_bytes / (1024 * 1024)
            raise AppError(
                code="FILE_TOO_LARGE",
                message=(
                    f"Uploaded image exceeds the maximum allowed size"
                    f" of {max_upload_size_mb:g}MB."
                ),
                status_code=status.HTTP_400_BAD_REQUEST,
                details={"max_upload_size_bytes": self.max_upload_size_bytes},
            )

        image_id = self.store.build_image_id(file.filename)
        upload_path = self.store.save_upload(image_id=image_id, content=content)

        try:
            model_spec, runner = self.runner_manager.resolve(options.model_version)
        except KeyError as exc:
            logger.warning("Unknown model version requested: %s", options.model_version)
            raise AppError(
                code="UNKNOWN_MODEL_VERSION",
                message="Requested model version is not registered.",
                status_code=status.HTTP_400_BAD_REQUEST,
                details={"model_version": options.model_version},
            ) from exc
        except RuntimeError as exc:
            logger.warning("Model unavailable: %s – %s", options.model_version, exc)
            raise AppError(
                code="MODEL_UNAVAILABLE",
                message=str(exc),
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                details={"model_version": options.model_version},
            ) from exc

        normalized_options = options.model_copy(update={"model_version": model_spec.model_version})

        logger.info(
            "Starting inference: image=%s model=%s:%s",
            file.filename,
            model_spec.model_name,
            model_spec.model_version,
        )

        loop = asyncio.get_event_loop()
        raw_prediction = await loop.run_in_executor(
            None,
            lambda: runner.predict(
                image_bytes=content,
                image_name=file.filename,
                options=normalized_options,
            ),
        )

        logger.info(
            "Inference complete: image=%s elapsed=%dms detections=%d",
            file.filename,
            raw_prediction.inference_ms,
            len(raw_prediction.detections),
        )

        response = PredictResponse(
            image_id=image_id,
            inference_ms=raw_prediction.inference_ms,
            model_name=raw_prediction.model_name,
            model_version=raw_prediction.model_version,
            backend=raw_prediction.backend,
            inference_mode=raw_prediction.inference_mode,
            detections=[
                Detection(
                    id=f"{image_id}-{index + 1}",
                    category=item.category,
                    confidence=item.confidence,
                    bbox=item.bbox,
                    mask=item.mask,
                    metrics=item.metrics,
                )
                for index, item in enumerate(raw_prediction.detections)
            ],
            artifacts=ArtifactLinks(upload_path=upload_path, json_path="", overlay_path=None),
        )

        if normalized_options.return_overlay and raw_prediction.overlay_png:
            overlay_path = self.store.save_overlay(
                image_id=image_id,
                content=raw_prediction.overlay_png,
            )
            response.artifacts.overlay_path = overlay_path

        json_path = self.store.save_json(
            image_id=image_id,
            payload=response.model_dump(mode="json"),
        )
        response.artifacts.json_path = json_path
        return response
