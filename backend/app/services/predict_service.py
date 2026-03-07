from __future__ import annotations

from pathlib import Path

from fastapi import UploadFile, status

from app.adapters.base import ModelRunner
from app.core.errors import AppError
from app.models.schemas import ArtifactLinks, Detection, PredictOptions, PredictResponse
from app.storage.local import LocalArtifactStore

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


class PredictService:
    def __init__(
        self,
        *,
        store: LocalArtifactStore,
        runner: ModelRunner,
        max_upload_size_bytes: int,
    ) -> None:
        self.store = store
        self.runner = runner
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
            raise AppError(
                code="FILE_TOO_LARGE",
                message="Uploaded image exceeds the maximum allowed size.",
                status_code=status.HTTP_400_BAD_REQUEST,
                details={"max_upload_size_bytes": self.max_upload_size_bytes},
            )

        image_id = self.store.build_image_id(file.filename)
        upload_path = self.store.save_upload(image_id=image_id, content=content)

        raw_prediction = self.runner.predict(
            image_bytes=content,
            image_name=file.filename,
            options=options,
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

        json_path = self.store.save_json(
            image_id=image_id,
            payload=response.model_dump(mode="json"),
        )
        response.artifacts.json_path = json_path
        return response
