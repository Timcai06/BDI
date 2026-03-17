from __future__ import annotations

from typing import Any, List, Protocol

from app.models.schemas import BoundingBox, MaskPayload, RawDetection


class RunnerOutputAdapter(Protocol):
    def adapt(self, raw_output: Any) -> List[RawDetection]:
        """Convert model-specific output to standard RawDetection list."""
        ...


class UltralyticsOutputAdapter:
    def adapt(self, raw_output: Any) -> List[RawDetection]:
        """Adapt Ultralytics Result object to List[RawDetection]."""
        # raw_output is expected to be an ultralytics.engine.results.Results object
        result = raw_output
        names = result.names
        detections: List[RawDetection] = []

        if result.boxes is not None and len(result.boxes) > 0:
            xyxy_list = result.boxes.xyxy.cpu().tolist()
            conf_list = result.boxes.conf.cpu().tolist()
            cls_list = result.boxes.cls.cpu().tolist()
            mask_segments = (
                result.masks.xy if result.masks is not None else [None] * len(xyxy_list)
            )

            for index, (xyxy, confidence, cls_id) in enumerate(
                zip(xyxy_list, conf_list, cls_list, strict=True)
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
        return detections
