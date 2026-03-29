from pathlib import Path
from io import BytesIO

from PIL import Image

from app.adapters.fusion_runner import FusionRunner
from app.adapters.registry import ModelRegistry, ModelSpec
from app.models.schemas import BoundingBox, PredictOptions, RawDetection, RawPrediction


class FakeRunner:
    def __init__(self, result: RawPrediction) -> None:
        self._result = result
        self.name = f"fake-{result.model_version}"
        self.ready = True

    def predict(self, **_) -> RawPrediction:
        return self._result

    def warmup(self) -> None:
        return None

    def close(self) -> None:
        self.ready = False


def _build_prediction(model_version: str, detections: list[RawDetection]) -> RawPrediction:
    return RawPrediction(
        model_name=model_version,
        model_version=model_version,
        backend="pytorch",
        inference_mode="direct",
        inference_ms=20,
        detections=detections,
    )


def _build_detection(category: str, confidence: float, x: float, y: float) -> RawDetection:
    return RawDetection(
        category=category,
        confidence=confidence,
        bbox=BoundingBox(x=x, y=y, width=20, height=20),
    )


def test_fusion_runner_prefers_specialist_for_seepage(tmp_path: Path, monkeypatch) -> None:
    general_weights = tmp_path / "general.pt"
    seepage_weights = tmp_path / "seepage.pt"
    general_weights.write_bytes(b"general")
    seepage_weights.write_bytes(b"seepage")

    registry = ModelRegistry(active_version="fusion-v1")
    registry.register(
        ModelSpec(
            model_name="general",
            model_version="v1-general",
            backend="pytorch",
            runner_kind="ultralytics",
            weights_path=general_weights,
        )
    )
    registry.register(
        ModelSpec(
            model_name="seepage",
            model_version="v2-seepage-specialist",
            backend="pytorch",
            runner_kind="ultralytics",
            weights_path=seepage_weights,
        )
    )
    fusion_spec = ModelSpec(
        model_name="dual-model-fusion",
        model_version="fusion-v1",
        backend="fusion",
        runner_kind="fusion",
        primary_model_version="v1-general",
        specialist_model_version="v2-seepage-specialist",
        specialist_categories=["seepage"],
        supports_masks=False,
    )

    primary_result = _build_prediction(
        "v1-general",
        [
            _build_detection("crack", 0.92, 10, 10),
            _build_detection("seepage", 0.41, 50, 50),
        ],
    )
    specialist_result = _build_prediction(
        "v2-seepage-specialist",
        [_build_detection("seepage", 0.88, 50, 50)],
    )

    def fake_load_runner_for_spec(spec, pixels_per_mm=10.0):
        if spec.model_version == "v1-general":
            return FakeRunner(primary_result)
        return FakeRunner(specialist_result)

    monkeypatch.setattr("app.adapters.fusion_runner.load_runner_for_spec", fake_load_runner_for_spec)

    runner = FusionRunner(spec=fusion_spec, registry=registry)
    result = runner.predict(
        image_bytes=b"fake",
        image_name="bridge.jpg",
        options=PredictOptions(model_version="fusion-v1"),
    )

    categories = [item.category for item in result.detections]
    confidences = {item.category: item.confidence for item in result.detections}
    sources = {item.category: item.source_role for item in result.detections}

    assert categories == ["crack", "seepage"]
    assert confidences["seepage"] == 0.88
    assert sources["crack"] == "general"
    assert sources["seepage"] == "specialist"


def test_fusion_runner_falls_back_to_primary_when_specialist_misses(
    tmp_path: Path, monkeypatch
) -> None:
    general_weights = tmp_path / "general.pt"
    seepage_weights = tmp_path / "seepage.pt"
    general_weights.write_bytes(b"general")
    seepage_weights.write_bytes(b"seepage")

    registry = ModelRegistry(active_version="fusion-v1")
    registry.register(
        ModelSpec(
            model_name="general",
            model_version="v1-general",
            backend="pytorch",
            runner_kind="ultralytics",
            weights_path=general_weights,
        )
    )
    registry.register(
        ModelSpec(
            model_name="seepage",
            model_version="v2-seepage-specialist",
            backend="pytorch",
            runner_kind="ultralytics",
            weights_path=seepage_weights,
        )
    )
    fusion_spec = ModelSpec(
        model_name="dual-model-fusion",
        model_version="fusion-v1",
        backend="fusion",
        runner_kind="fusion",
        primary_model_version="v1-general",
        specialist_model_version="v2-seepage-specialist",
        specialist_categories=["seepage"],
        supports_masks=False,
    )

    primary_result = _build_prediction(
        "v1-general",
        [_build_detection("seepage", 0.52, 50, 50)],
    )
    specialist_result = _build_prediction("v2-seepage-specialist", [])

    def fake_load_runner_for_spec(spec, pixels_per_mm=10.0):
        if spec.model_version == "v1-general":
            return FakeRunner(primary_result)
        return FakeRunner(specialist_result)

    monkeypatch.setattr("app.adapters.fusion_runner.load_runner_for_spec", fake_load_runner_for_spec)

    runner = FusionRunner(spec=fusion_spec, registry=registry)
    result = runner.predict(
        image_bytes=b"fake",
        image_name="bridge.jpg",
        options=PredictOptions(model_version="fusion-v1"),
    )

    assert len(result.detections) == 1
    assert result.detections[0].category == "seepage"
    assert result.detections[0].confidence == 0.52
    assert result.detections[0].source_role == "general"


def test_fusion_runner_generates_overlay_when_requested(tmp_path: Path, monkeypatch) -> None:
    general_weights = tmp_path / "general.pt"
    seepage_weights = tmp_path / "seepage.pt"
    general_weights.write_bytes(b"general")
    seepage_weights.write_bytes(b"seepage")

    registry = ModelRegistry(active_version="fusion-v1")
    registry.register(
        ModelSpec(
            model_name="general",
            model_version="v1-general",
            backend="pytorch",
            runner_kind="ultralytics",
            weights_path=general_weights,
        )
    )
    registry.register(
        ModelSpec(
            model_name="seepage",
            model_version="v2-seepage-specialist",
            backend="pytorch",
            runner_kind="ultralytics",
            weights_path=seepage_weights,
        )
    )
    fusion_spec = ModelSpec(
        model_name="dual-model-fusion",
        model_version="fusion-v1",
        backend="fusion",
        runner_kind="fusion",
        primary_model_version="v1-general",
        specialist_model_version="v2-seepage-specialist",
        specialist_categories=["seepage"],
        supports_masks=False,
        supports_overlay=True,
    )

    primary_result = _build_prediction(
        "v1-general",
        [_build_detection("crack", 0.92, 10, 10)],
    )
    specialist_result = _build_prediction("v2-seepage-specialist", [])

    def fake_load_runner_for_spec(spec, pixels_per_mm=10.0):
        if spec.model_version == "v1-general":
            return FakeRunner(primary_result)
        return FakeRunner(specialist_result)

    monkeypatch.setattr("app.adapters.fusion_runner.load_runner_for_spec", fake_load_runner_for_spec)

    runner = FusionRunner(spec=fusion_spec, registry=registry)
    image = Image.new("RGB", (8, 8), color=(255, 255, 255))
    buffer = BytesIO()
    image.save(buffer, format="JPEG")
    result = runner.predict(
        image_bytes=buffer.getvalue(),
        image_name="bridge.jpg",
        options=PredictOptions(model_version="fusion-v1", return_overlay=True),
    )

    assert result.overlay_png is not None
