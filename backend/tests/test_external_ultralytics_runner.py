from __future__ import annotations

import json
from pathlib import Path

from app.adapters.external_ultralytics_runner import ExternalUltralyticsRunner
from app.adapters.registry import ModelSpec
from app.models.schemas import PredictOptions


def test_external_ultralytics_runner_invokes_worker_and_parses_payload(
    tmp_path: Path,
    monkeypatch,
) -> None:
    weights_path = tmp_path / "model.pt"
    runtime_root = tmp_path / "runtime"
    weights_path.write_bytes(b"weights")
    runtime_root.mkdir()

    spec = ModelSpec(
        model_name="latest-main",
        model_version="main-latest-mask-v1",
        backend="pytorch",
        runner_kind="external_ultralytics",
        weights_path=weights_path,
        runtime_root=runtime_root,
        supports_masks=True,
    )

    def fake_run(command, cwd, check, capture_output, text):  # noqa: ANN001
        assert "--runtime-root" in command
        output_path = Path(command[command.index("--output") + 1])
        payload = {
            "model_name": "latest-main",
            "model_version": "main-latest-mask-v1",
            "backend": "pytorch",
            "inference_mode": "direct",
            "inference_ms": 0,
            "inference_breakdown": {},
            "detections": [
                {
                    "category": "Seepage",
                    "confidence": 0.91,
                    "bbox": {"x": 1, "y": 2, "width": 30, "height": 40},
                    "mask": {"format": "polygon", "points": [[1, 2], [3, 4], [5, 6]]},
                    "metrics": {"length_mm": 11.0, "width_mm": 3.0, "area_mm2": 22.0},
                    "source_role": None,
                    "source_model_name": None,
                    "source_model_version": None,
                }
            ],
            "metadata": {"runtime_root": str(runtime_root), "weights_path": str(weights_path)},
            "overlay_png_b64": None,
        }
        output_path.write_text(json.dumps(payload), encoding="utf-8")

        class Completed:
            stdout = ""
            stderr = ""

        return Completed()

    monkeypatch.setattr("app.adapters.external_ultralytics_runner.subprocess.run", fake_run)

    runner = ExternalUltralyticsRunner.from_model_spec(spec)
    result = runner.predict(
        image_bytes=b"fake-image",
        image_name="bridge.jpg",
        options=PredictOptions(model_version="main-latest-mask-v1"),
    )

    assert result.model_version == "main-latest-mask-v1"
    assert result.detections[0].category == "seepage"
    assert result.detections[0].mask is not None
    assert result.metadata["runtime_root"] == str(runtime_root)
