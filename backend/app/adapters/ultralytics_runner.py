from __future__ import annotations

import io
import logging
import time
from dataclasses import dataclass
from typing import Optional

from PIL import Image

from app.adapters.output_adapter import UltralyticsOutputAdapter
from app.adapters.registry import ModelSpec
from app.models.schemas import PredictOptions, RawPrediction

logger = logging.getLogger(__name__)


@dataclass
class UltralyticsRunner:
    model_name: str
    model_version: str
    backend: str
    weights_path: str
    device: str
    imgsz: int
    model: object
    pixels_per_mm: float = 10.0
    adapter: Optional[UltralyticsOutputAdapter] = None
    name: str = "ultralytics-runner"
    ready: bool = True

    def __post_init__(self):
        if self.adapter is None:
            self.adapter = UltralyticsOutputAdapter(pixels_per_mm=self.pixels_per_mm)

    @classmethod
    def from_model_spec(cls, spec: ModelSpec, pixels_per_mm: float = 10.0) -> "UltralyticsRunner":
        from ultralytics import YOLO

        if spec.weights_path is None:
            raise RuntimeError("Ultralytics runner requires a configured weights path.")

        model = YOLO(str(spec.weights_path))
        logger.info(
            "Ultralytics model loaded: weights=%s device=%s imgsz=%d",
            spec.weights_path,
            spec.device,
            spec.imgsz,
        )
        return cls(
            model_name=spec.model_name,
            model_version=spec.model_version,
            backend=spec.backend,
            weights_path=str(spec.weights_path),
            device=spec.device,
            imgsz=spec.imgsz,
            model=model,
            pixels_per_mm=pixels_per_mm,
        )

    def predict(
        self,
        *,
        image_bytes: bytes,
        image_name: str,
        options: PredictOptions,
    ) -> RawPrediction:
        start_time = time.time()
        img = Image.open(io.BytesIO(image_bytes))

        results = self.model.predict(
            source=img,
            conf=options.confidence,
            iou=options.iou,
            imgsz=self.imgsz,
            device=self.device,
            verbose=False,
        )
        elapsed_ms = int((time.time() - start_time) * 1000)

        result = results[0]
        assert self.adapter is not None, "Adapter should be initialized"
        detections = self.adapter.adapt(result)

        overlay_bytes = None
        if options.return_overlay:
            plotted = result.plot()
            overlay_image = Image.fromarray(plotted[:, :, ::-1])
            buffer = io.BytesIO()
            overlay_image.save(buffer, format="WEBP", quality=85)
            overlay_bytes = buffer.getvalue()

        return RawPrediction(
            model_name=self.model_name,
            model_version=self.model_version,
            backend=self.backend,
            inference_mode=options.inference_mode,
            inference_ms=elapsed_ms,
            detections=detections,
            metadata={
                "source_image": image_name,
                "weights_path": self.weights_path,
                "device": self.device,
            },
            overlay_png=overlay_bytes,
        )

    def warmup(self) -> None:
        """Perform a dummy inference to warm up GPU kernels."""
        try:
            import numpy as np

            dummy_img = np.zeros((self.imgsz, self.imgsz, 3), dtype=np.uint8)
            self.model.predict(dummy_img, imgsz=self.imgsz, verbose=False)
            logger.info("Runner warmup completed: %s", self.model_name)
        except Exception:
            logger.warning("Runner warmup failed", exc_info=True)

    def health_check(self) -> dict:
        """Return detailed health status."""
        status = {
            "name": self.name,
            "ready": self.ready,
            "device": self.device,
            "model": f"{self.model_name}:{self.model_version}",
        }
        if "cuda" in self.device:
            try:
                import torch

                status["gpu"] = {
                    "allocated": torch.cuda.memory_allocated(),
                    "reserved": torch.cuda.memory_reserved(),
                }
            except ImportError:
                pass
        return status

    def close(self) -> None:
        """Release resources."""
        logger.info("Closing runner: %s", self.model_name)
        self.ready = False
        del self.model
        if "cuda" in self.device:
            try:
                import torch

                torch.cuda.empty_cache()
            except ImportError:
                pass
