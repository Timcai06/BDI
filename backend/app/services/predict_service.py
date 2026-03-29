from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Tuple

from fastapi import UploadFile, status

from app.adapters.manager import RunnerManager
from app.adapters.base import ModelRunner
from app.adapters.registry import ModelSpec
from app.core.errors import AppError
from app.models.schemas import ArtifactLinks, Detection, PredictOptions, PredictResponse, RawPrediction
from app.storage.local import LocalArtifactStore

logger = logging.getLogger(__name__)

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def _format_metric(value: float | None, unit: str) -> str:
    if value is None:
        return "n/a"
    return f"{value:.2f}{unit}"


def classify_runtime_error(exc: Exception) -> tuple[str, str, int]:
    if isinstance(exc, TimeoutError):
        return (
            "MODEL_TIMEOUT",
            "Model inference timed out. Please retry or use a lighter model.",
            status.HTTP_504_GATEWAY_TIMEOUT,
        )

    if isinstance(exc, (ValueError, TypeError, KeyError, IndexError)):
        return (
            "MODEL_OUTPUT_INVALID",
            "Model returned an unsupported output format.",
            status.HTTP_502_BAD_GATEWAY,
        )

    return (
        "MODEL_RUNTIME_ERROR",
        "Model inference failed. Please retry or switch to another model version.",
        status.HTTP_503_SERVICE_UNAVAILABLE,
    )


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
        content = await self._read_upload(file)
        image_id, upload_path = self._persist_upload(file=file, content=content)
        model_spec, runner = self._resolve_runner(options.model_version)
        self._validate_model_capabilities(model_spec=model_spec, options=options)
        normalized_options = options.model_copy(update={"model_version": model_spec.model_version})

        raw_prediction = await self._run_prediction(
            file=file,
            content=content,
            model_spec=model_spec,
            runner=runner,
            options=normalized_options,
        )
        response = self._build_response(
            image_id=image_id,
            upload_path=upload_path,
            raw_prediction=raw_prediction,
        )
        self._log_detection_metrics(
            file=file,
            options=normalized_options,
            response=response,
        )
        self._persist_prediction_artifacts(
            image_id=image_id,
            options=normalized_options,
            raw_prediction=raw_prediction,
            response=response,
        )
        return response

    async def _read_upload(self, file: UploadFile) -> bytes:
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
        return content

    def _persist_upload(self, *, file: UploadFile, content: bytes) -> Tuple[str, str]:
        image_id = self.store.build_image_id(file.filename)
        upload_path = self.store.save_upload(image_id=image_id, content=content)
        return image_id, upload_path

    def _resolve_runner(self, model_version: str | None) -> tuple[ModelSpec, ModelRunner]:
        try:
            return self.runner_manager.resolve(model_version)
        except KeyError as exc:
            logger.warning("Unknown model version requested: %s", model_version)
            raise AppError(
                code="UNKNOWN_MODEL_VERSION",
                message="Requested model version is not registered.",
                status_code=status.HTTP_400_BAD_REQUEST,
                details={"model_version": model_version},
            ) from exc
        except (ImportError, ModuleNotFoundError) as exc:
            logger.warning("Model load failed: %s", exc)
            raise AppError(
                code="MODEL_LOAD_FAILED",
                message="Model dependencies are missing or failed to load.",
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                details={"model_version": model_version, "reason": str(exc)},
            ) from exc
        except RuntimeError as exc:
            logger.warning("Model unavailable: %s – %s", model_version, exc)
            raise AppError(
                code="MODEL_UNAVAILABLE",
                message=str(exc),
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                details={"model_version": model_version},
            ) from exc

    def _validate_model_capabilities(
        self,
        *,
        model_spec: ModelSpec,
        options: PredictOptions,
    ) -> None:
        if options.return_overlay and not model_spec.supports_overlay:
            raise AppError(
                code="MODEL_CAPABILITY_UNSUPPORTED",
                message="Selected model does not support overlay output.",
                status_code=status.HTTP_400_BAD_REQUEST,
                details={
                    "model_version": model_spec.model_version,
                    "capability": "supports_overlay",
                },
            )

        if options.inference_mode == "sliced" and not model_spec.supports_sliced_inference:
            raise AppError(
                code="MODEL_CAPABILITY_UNSUPPORTED",
                message="Selected model does not support sliced inference mode.",
                status_code=status.HTTP_400_BAD_REQUEST,
                details={
                    "model_version": model_spec.model_version,
                    "capability": "supports_sliced_inference",
                },
            )

    async def _run_prediction(
        self,
        *,
        file: UploadFile,
        content: bytes,
        model_spec: ModelSpec,
        runner: ModelRunner,
        options: PredictOptions,
    ) -> RawPrediction:
        logger.info(
            "Starting inference: image=%s model=%s:%s",
            file.filename,
            model_spec.model_name,
            model_spec.model_version,
        )

        loop = asyncio.get_event_loop()
        try:
            raw_prediction = await loop.run_in_executor(
                None,
                lambda: runner.predict(
                    image_bytes=content,
                    image_name=file.filename,
                    options=options,
                ),
            )
        except Exception as exc:
            error_code, error_message, status_code = classify_runtime_error(exc)
            logger.exception(
                "Inference runtime failure: image=%s model=%s:%s",
                file.filename,
                model_spec.model_name,
                model_spec.model_version,
            )
            raise AppError(
                code=error_code,
                message=error_message,
                status_code=status_code,
                details={
                    "model_version": model_spec.model_version,
                    "model_name": model_spec.model_name,
                    "reason": str(exc),
                },
            ) from exc

        logger.info(
            "Inference complete: image=%s elapsed=%dms detections=%d",
            file.filename,
            raw_prediction.inference_ms,
            len(raw_prediction.detections),
        )
        return raw_prediction

    def _build_response(
        self,
        *,
        image_id: str,
        upload_path: str,
        raw_prediction: RawPrediction,
    ) -> PredictResponse:
        response = PredictResponse(
            image_id=image_id,
            inference_ms=raw_prediction.inference_ms,
            inference_breakdown=raw_prediction.inference_breakdown,
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
                    source_role=item.source_role,
                    source_model_name=item.source_model_name,
                    source_model_version=item.source_model_version,
                )
                for index, item in enumerate(raw_prediction.detections)
            ],
            artifacts=ArtifactLinks(upload_path=upload_path, json_path="", overlay_path=None),
        )
        response.mask_detection_count = sum(1 for item in response.detections if item.mask is not None)
        response.has_masks = response.mask_detection_count > 0
        return response

    def _log_detection_metrics(
        self,
        *,
        file: UploadFile,
        options: PredictOptions,
        response: PredictResponse,
    ) -> None:
        measured_detections = [
            detection
            for detection in response.detections
            if any(
                metric is not None
                for metric in (
                    detection.metrics.length_mm,
                    detection.metrics.width_mm,
                    detection.metrics.area_mm2,
                )
            )
        ]

        logger.info(
            "Physical metrics summary: image=%s pixels_per_mm=%.4f measured=%d/%d",
            file.filename,
            options.pixels_per_mm,
            len(measured_detections),
            len(response.detections),
        )
        for detection in measured_detections:
            logger.info(
                (
                    "Detection metrics: image=%s detection=%s category=%s confidence=%.3f "
                    "length_mm=%s width_mm=%s area_mm2=%s"
                ),
                file.filename,
                detection.id,
                detection.category,
                detection.confidence,
                _format_metric(detection.metrics.length_mm, "mm"),
                _format_metric(detection.metrics.width_mm, "mm"),
                _format_metric(detection.metrics.area_mm2, "mm2"),
            )

    def _persist_prediction_artifacts(
        self,
        *,
        image_id: str,
        options: PredictOptions,
        raw_prediction: RawPrediction,
        response: PredictResponse,
    ) -> None:
        if options.return_overlay and raw_prediction.overlay_png:
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
