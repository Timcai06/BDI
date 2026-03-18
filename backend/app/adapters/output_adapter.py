from __future__ import annotations

from typing import Any, List, Protocol

from app.models.schemas import BoundingBox, DetectionMetrics, MaskPayload, RawDetection
from app.core.metrics_calculator import calculate_metrics_from_mask


class RunnerOutputAdapter(Protocol):
    def adapt(self, raw_output: Any) -> List[RawDetection]:
        """Convert model-specific output to standard RawDetection list."""
        ...


class UltralyticsOutputAdapter:
    def __init__(self, pixels_per_mm: float = 10.0):
        """Initialize adapter with pixel-to-mm conversion factor.

        Args:
            pixels_per_mm: Conversion factor for physical measurements.
                          Default 10.0 means 10 pixels = 1 millimeter.
        """
        self.pixels_per_mm = pixels_per_mm

    def adapt(self, raw_output: Any) -> List[RawDetection]:
        """Adapt Ultralytics Result object to List[RawDetection].

        Also calculates physical metrics (length, width, area) from mask polygons.
        """
        result = raw_output
        names = result.names
        detections: List[RawDetection] = []

        if result.boxes is not None and len(result.boxes) > 0:
            xyxy_list = result.boxes.xyxy.cpu().tolist()
            conf_list = result.boxes.conf.cpu().tolist()
            cls_list = result.boxes.cls.cpu().tolist()
            mask_segments = result.masks.xy if result.masks is not None else [None] * len(xyxy_list)

            if not (len(xyxy_list) == len(conf_list) == len(cls_list)):
                raise RuntimeError(
                    "Ultralytics output is inconsistent: boxes/conf/classes length mismatch."
                )

            for index, (xyxy, confidence, cls_id) in enumerate(zip(xyxy_list, conf_list, cls_list)):
                x1, y1, x2, y2 = xyxy
                bbox = BoundingBox(
                    x=max(x1, 0),
                    y=max(y1, 0),
                    width=max(x2 - x1, 0),
                    height=max(y2 - y1, 0),
                )
                segment = mask_segments[index] if index < len(mask_segments) else None
                mask = None
                metrics = DetectionMetrics()

                if segment is not None:
                    # Convert segment to list format for metrics calculation
                    segment_points = [point.tolist() for point in segment]
                    mask = MaskPayload(
                        points=[
                            [int(round(point[0])), int(round(point[1]))] for point in segment_points
                        ]
                    )
                    # Calculate physical metrics from mask
                    physical_metrics = calculate_metrics_from_mask(
                        segment_points, self.pixels_per_mm
                    )
                    metrics = DetectionMetrics(
                        length_mm=physical_metrics.length_mm,
                        width_mm=physical_metrics.width_mm,
                        area_mm2=physical_metrics.area_mm2,
                    )

                category_name = names.get(int(cls_id), str(int(cls_id)))
                detections.append(
                    RawDetection(
                        category=category_name,
                        confidence=float(confidence),
                        bbox=bbox,
                        mask=mask,
                        metrics=metrics,
                    )
                )
        return detections
