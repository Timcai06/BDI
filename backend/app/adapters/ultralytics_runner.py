from __future__ import annotations

import io
import time
from dataclasses import dataclass

import numpy as np
from PIL import Image

from app.core.config import Settings
from app.models.schemas import (
    BoundingBox,
    MaskPayload,
    PredictOptions,
    RawDetection,
    RawPrediction,
)


@dataclass
class UltralyticsRunner:
    model_name: str
    model_version: str
    backend: str
    weights_path: str
    device: str
    imgsz: int
    model: object
    name: str = "ultralytics-runner"
    ready: bool = True

    @classmethod
    def from_settings(cls, settings: Settings) -> "UltralyticsRunner":
        from ultralytics import YOLO

        model = YOLO(str(settings.model_weights_path))
        return cls(
            model_name=settings.model_name,
            model_version=settings.model_version,
            backend=settings.model_backend,
            weights_path=str(settings.model_weights_path),
            device=settings.model_device,
            imgsz=settings.model_imgsz,
            model=model,
        )

    def predict(
        self,
        *,
        image_bytes: bytes,
        image_name: str,
        options: PredictOptions,
    ) -> RawPrediction:
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image_array = np.array(pil_image)

        started_at = time.perf_counter()
        results = self.model.predict(
            source=image_array,
            conf=options.confidence,
            iou=options.iou,
            imgsz=self.imgsz,
            device=self.device,
            verbose=False,
        )
        elapsed_ms = int((time.perf_counter() - started_at) * 1000)

        result = results[0]
        names = result.names
        detections: list[RawDetection] = []

        if result.boxes is not None and len(result.boxes) > 0:
            xyxy_list = result.boxes.xyxy.cpu().tolist()
            conf_list = result.boxes.conf.cpu().tolist()
            cls_list = result.boxes.cls.cpu().tolist()
            mask_segments = result.masks.xy if result.masks is not None else [None] * len(xyxy_list)

            # Ultralytics returns aligned arrays here; keep this loop Python 3.9 compatible.
            for index, (xyxy, confidence, cls_id) in enumerate(
                zip(xyxy_list, conf_list, cls_list)  # noqa: B905
            ):
                x1, y1, x2, y2 = xyxy
                bbox = BoundingBox(
                    x=max(x1, 0),
                    y=max(y1, 0),
                    width=max(x2 - x1, 0),
                    height=max(y2 - y1, 0),
                )
                segment = mask_segments[index] if index < len(mask_segments) else None
                mask = None
                if segment is not None:
                    mask = MaskPayload(
                        points=[
                            [int(round(point[0])), int(round(point[1]))]
                            for point in segment.tolist()
                        ]
                    )

                category_name = names.get(int(cls_id), str(int(cls_id)))
                detections.append(
                    RawDetection(
                        category=category_name,
                        confidence=float(confidence),
                        bbox=bbox,
                        mask=mask,
                    )
                )

        overlay_png = None
        if options.return_overlay:
            plotted = result.plot()
            overlay_image = Image.fromarray(plotted[:, :, ::-1])
            buffer = io.BytesIO()
            overlay_image.save(buffer, format="PNG")
            overlay_png = buffer.getvalue()

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
            overlay_png=overlay_png,
        )
