from __future__ import annotations

import io
from dataclasses import dataclass, field
from typing import Dict, Iterable, List

from PIL import Image, ImageDraw

from app.adapters.base import ModelRunner
from app.adapters.factory import load_runner_for_spec
from app.adapters.registry import ModelRegistry, ModelSpec
from app.models.schemas import BoundingBox, PredictOptions, RawDetection, RawPrediction


def _bbox_iou(left: BoundingBox, right: BoundingBox) -> float:
    left_x2 = left.x + left.width
    left_y2 = left.y + left.height
    right_x2 = right.x + right.width
    right_y2 = right.y + right.height

    inter_x1 = max(left.x, right.x)
    inter_y1 = max(left.y, right.y)
    inter_x2 = min(left_x2, right_x2)
    inter_y2 = min(left_y2, right_y2)

    inter_w = max(inter_x2 - inter_x1, 0)
    inter_h = max(inter_y2 - inter_y1, 0)
    if inter_w == 0 or inter_h == 0:
        return 0.0

    intersection = inter_w * inter_h
    left_area = max(left.width, 0) * max(left.height, 0)
    right_area = max(right.width, 0) * max(right.height, 0)
    union = left_area + right_area - intersection
    if union <= 0:
        return 0.0
    return intersection / union


def _dedupe_by_category(
    detections: Iterable[RawDetection],
    *,
    iou_threshold: float = 0.5,
) -> List[RawDetection]:
    kept: List[RawDetection] = []
    for detection in sorted(detections, key=lambda item: item.confidence, reverse=True):
        duplicate = any(
            existing.category == detection.category and _bbox_iou(existing.bbox, detection.bbox) >= iou_threshold
            for existing in kept
        )
        if not duplicate:
            kept.append(detection)
    return kept


def _with_source(
    detections: Iterable[RawDetection],
    *,
    role: str,
    model_name: str,
    model_version: str,
) -> List[RawDetection]:
    return [
        detection.model_copy(
            update={
                "source_role": role,
                "source_model_name": model_name,
                "source_model_version": model_version,
            }
        )
        for detection in detections
    ]


def _group_by_category(detections: Iterable[RawDetection]) -> Dict[str, List[RawDetection]]:
    grouped: Dict[str, List[RawDetection]] = {}
    for detection in detections:
        grouped.setdefault(detection.category, []).append(detection)
    return grouped


_CATEGORY_COLORS = {
    "crack": "#00D2FF",
    "breakage": "#FF8A00",
    "comb": "#F97316",
    "hole": "#8B5CF6",
    "reinforcement": "#EF4444",
    "seepage": "#22C55E",
}


def _render_overlay(image_bytes: bytes, detections: List[RawDetection]) -> bytes:
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    canvas = image.copy()
    draw = ImageDraw.Draw(canvas, "RGBA")

    for detection in detections:
        color = _CATEGORY_COLORS.get(detection.category, "#FFFFFF")
        x1 = detection.bbox.x
        y1 = detection.bbox.y
        x2 = detection.bbox.x + detection.bbox.width
        y2 = detection.bbox.y + detection.bbox.height

        draw.rectangle((x1, y1, x2, y2), outline=color, width=3)

        if detection.mask is not None and detection.mask.points:
            polygon = [tuple(point) for point in detection.mask.points]
            draw.polygon(polygon, outline=color, fill=(255, 255, 255, 0))

        label = f"{detection.category} {detection.confidence:.2f}"
        text_origin = (x1, max(y1 - 16, 0))
        draw.rectangle(
            (
                text_origin[0],
                text_origin[1],
                text_origin[0] + max(len(label) * 7, 56),
                text_origin[1] + 14,
            ),
            fill=(0, 0, 0, 180),
        )
        draw.text((text_origin[0] + 4, text_origin[1] + 2), label, fill=color)

    buffer = io.BytesIO()
    canvas.save(buffer, format="WEBP", quality=85)
    return buffer.getvalue()


@dataclass
class FusionRunner:
    spec: ModelSpec
    registry: ModelRegistry
    pixels_per_mm: float = 10.0
    name: str = "fusion-runner"
    ready: bool = True
    _component_runners: Dict[str, ModelRunner] = field(default_factory=dict)

    def _resolve_component_runner(self, version: str) -> tuple[ModelSpec, ModelRunner]:
        component_spec = self.registry.get(version)
        if component_spec.runner_kind == "fusion":
            raise RuntimeError("Fusion runner does not support nested fusion dependencies.")
        if not component_spec.is_available:
            raise RuntimeError(f"Fusion dependency '{version}' is unavailable.")

        runner = self._component_runners.get(version)
        if runner is None:
            runner = load_runner_for_spec(component_spec, self.pixels_per_mm)
            try:
                runner.warmup()
            except Exception:
                pass
            self._component_runners[version] = runner
        return component_spec, runner

    def _validate_fusion_spec(self) -> set[str]:
        if self.spec.primary_model_version is None or self.spec.specialist_model_version is None:
            raise RuntimeError("Fusion runner requires primary and specialist model versions.")

        specialist_categories = set(self.spec.specialist_categories)
        if not specialist_categories:
            raise RuntimeError("Fusion runner requires at least one specialist category.")
        return specialist_categories

    def _run_component_prediction(
        self,
        *,
        image_bytes: bytes,
        image_name: str,
        options: PredictOptions,
        model_version: str,
    ) -> tuple[ModelSpec, RawPrediction]:
        component_spec, component_runner = self._resolve_component_runner(model_version)
        component_options = options.model_copy(update={"model_version": component_spec.model_version})
        result = component_runner.predict(
            image_bytes=image_bytes,
            image_name=image_name,
            options=component_options,
        )
        return component_spec, result

    def _select_detections(
        self,
        *,
        primary_detections: List[RawDetection],
        specialist_detections: List[RawDetection],
        specialist_categories: set[str],
    ) -> List[RawDetection]:
        selected: List[RawDetection] = []
        primary_by_category = _group_by_category(primary_detections)
        specialist_by_category = _group_by_category(specialist_detections)

        for category, detections in primary_by_category.items():
            if category not in specialist_categories:
                selected.extend(detections)

        for category in specialist_categories:
            specialist_hits = specialist_by_category.get(category, [])
            if specialist_hits:
                selected.extend(specialist_hits)
            else:
                selected.extend(primary_by_category.get(category, []))

        return _dedupe_by_category(selected)

    def _build_metadata(
        self,
        *,
        image_name: str,
        primary_spec: ModelSpec,
        specialist_spec: ModelSpec,
        specialist_categories: set[str],
    ) -> dict:
        return {
            "source_image": image_name,
            "fusion": {
                "primary_model_version": primary_spec.model_version,
                "specialist_model_version": specialist_spec.model_version,
                "specialist_categories": sorted(specialist_categories),
            },
        }

    def predict(
        self,
        *,
        image_bytes: bytes,
        image_name: str,
        options: PredictOptions,
    ) -> RawPrediction:
        specialist_categories = self._validate_fusion_spec()

        primary_spec, primary_result = self._run_component_prediction(
            image_bytes=image_bytes,
            image_name=image_name,
            options=options,
            model_version=self.spec.primary_model_version,
        )
        specialist_spec, specialist_result = self._run_component_prediction(
            image_bytes=image_bytes,
            image_name=image_name,
            options=options,
            model_version=self.spec.specialist_model_version,
        )

        primary_detections = _with_source(
            primary_result.detections,
            role="general",
            model_name=primary_spec.model_name,
            model_version=primary_spec.model_version,
        )
        specialist_detections = _with_source(
            specialist_result.detections,
            role="specialist",
            model_name=specialist_spec.model_name,
            model_version=specialist_spec.model_version,
        )
        merged_detections = self._select_detections(
            primary_detections=primary_detections,
            specialist_detections=specialist_detections,
            specialist_categories=specialist_categories,
        )
        breakdown = {
            "primary_model": primary_result.inference_ms,
            "specialist_model": specialist_result.inference_ms,
            "fusion_post": 1,
        }
        overlay_bytes = _render_overlay(image_bytes, merged_detections) if options.return_overlay else None

        return RawPrediction(
            model_name=self.spec.model_name,
            model_version=self.spec.model_version,
            backend=self.spec.backend,
            inference_mode=options.inference_mode,
            inference_ms=sum(breakdown.values()),
            inference_breakdown=breakdown,
            detections=merged_detections,
            metadata=self._build_metadata(
                image_name=image_name,
                primary_spec=primary_spec,
                specialist_spec=specialist_spec,
                specialist_categories=specialist_categories,
            ),
            overlay_png=overlay_bytes,
        )

    def warmup(self) -> None:
        return None

    def health_check(self) -> dict:
        return {
            "name": self.name,
            "ready": self.ready,
            "primary_model_version": self.spec.primary_model_version,
            "specialist_model_version": self.spec.specialist_model_version,
            "specialist_categories": self.spec.specialist_categories,
        }

    def close(self) -> None:
        self.ready = False
        for runner in self._component_runners.values():
            try:
                runner.close()
            except Exception:
                pass
        self._component_runners.clear()
