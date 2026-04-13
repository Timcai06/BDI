from __future__ import annotations

import io

from PIL import Image, ImageDraw

from app.adapters.base import ModelRunner
from app.models.schemas import (
    BoundingBox,
    DetectionMetrics,
    MaskPayload,
    PredictOptions,
    RawDetection,
    RawPrediction,
)


class MockRunner(ModelRunner):
    name = "mock-runner"
    ready = True

    def predict(
        self,
        *,
        image_bytes: bytes,
        image_name: str,
        options: PredictOptions,
    ) -> RawPrediction:
        size_bias = min(max(len(image_bytes) // 2048, 1), 8)

        detections = [
            RawDetection(
                category="crack",
                confidence=max(options.confidence, 0.86),
                bbox=BoundingBox(x=42, y=88, width=120 + size_bias * 4, height=28),
                mask=MaskPayload(points=[[42, 88], [162, 88], [158, 116], [46, 112]]),
                metrics=DetectionMetrics(length_mm=128.4, width_mm=3.1, area_mm2=301.7),
            ),
            RawDetection(
                category="spalling",
                confidence=0.73,
                bbox=BoundingBox(x=214, y=146, width=96, height=84 + size_bias * 3),
                mask=MaskPayload(points=[[214, 146], [302, 154], [296, 228], [220, 222]]),
                metrics=DetectionMetrics(area_mm2=842.0),
            ),
        ]

        overlay_bytes = None
        if options.return_overlay:
            overlay = Image.new("RGB", (640, 360), color=(242, 242, 242))
            draw = ImageDraw.Draw(overlay)
            draw.rectangle((42, 88, 162, 116), outline=(0, 122, 255), width=4)
            draw.rectangle((214, 146, 310, 254), outline=(255, 120, 0), width=4)
            buffer = io.BytesIO()
            overlay.save(buffer, format="WEBP", quality=85)
            overlay_bytes = buffer.getvalue()

        return RawPrediction(
            model_name="yolov8-seg",
            model_version=options.model_version,
            backend="mock",
            inference_mode=options.inference_mode,
            inference_ms=118,
            detections=detections,
            metadata={"source_image": image_name},
            overlay_png=overlay_bytes,
        )

    def warmup(self) -> None:
        pass

    def health_check(self) -> dict:
        return {
            "name": self.name,
            "ready": self.ready,
            "backend": "mock",
        }

    def close(self) -> None:
        self.ready = False
