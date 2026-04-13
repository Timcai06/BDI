from __future__ import annotations

import base64
import json
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from app.adapters.base import ModelRunner
from app.adapters.registry import ModelSpec
from app.models.schemas import PredictOptions, RawPrediction


@dataclass
class ExternalUltralyticsRunner(ModelRunner):
    model_name: str
    model_version: str
    backend: str
    weights_path: Path
    runtime_root: Path
    device: str
    imgsz: int
    python_executable: str = sys.executable
    name: str = "external-ultralytics-runner"
    ready: bool = True

    @classmethod
    def from_model_spec(
        cls,
        spec: ModelSpec,
        pixels_per_mm: float = 10.0,
    ) -> "ExternalUltralyticsRunner":
        del pixels_per_mm
        if spec.weights_path is None:
            raise RuntimeError("External ultralytics runner requires a configured weights path.")
        if spec.runtime_root is None:
            raise RuntimeError("External ultralytics runner requires a configured runtime root.")

        return cls(
            model_name=spec.model_name,
            model_version=spec.model_version,
            backend=spec.backend,
            weights_path=spec.weights_path,
            runtime_root=spec.runtime_root,
            device=spec.device,
            imgsz=spec.imgsz,
        )

    def predict(
        self,
        *,
        image_bytes: bytes,
        image_name: str,
        options: PredictOptions,
    ) -> RawPrediction:
        started_at = time.perf_counter()
        image_suffix = Path(image_name).suffix or ".jpg"

        with tempfile.TemporaryDirectory(prefix="bdi-ext-runner-") as tmpdir:
            tmpdir_path = Path(tmpdir)
            input_path = tmpdir_path / f"input{image_suffix}"
            output_path = tmpdir_path / "prediction.json"
            input_path.write_bytes(image_bytes)

            command = [
                self.python_executable,
                "-m",
                "app.adapters.external_ultralytics_worker",
                "--runtime-root",
                str(self.runtime_root),
                "--weights",
                str(self.weights_path),
                "--image",
                str(input_path),
                "--confidence",
                str(options.confidence),
                "--iou",
                str(options.iou),
                "--imgsz",
                str(self.imgsz),
                "--device",
                self.device,
                "--pixels-per-mm",
                str(options.pixels_per_mm),
                "--model-name",
                self.model_name,
                "--model-version",
                self.model_version,
                "--backend",
                self.backend,
                "--inference-mode",
                options.inference_mode,
                "--output",
                str(output_path),
            ]
            if options.return_overlay:
                command.append("--return-overlay")

            try:
                subprocess.run(
                    command,
                    cwd=Path(__file__).resolve().parents[2],
                    check=True,
                    capture_output=True,
                    text=True,
                )
            except subprocess.CalledProcessError as exc:
                details = (exc.stderr or exc.stdout or "").strip()
                if details:
                    raise RuntimeError(f"External runtime failed: {details}") from exc
                raise

            payload = json.loads(output_path.read_text(encoding="utf-8"))

        overlay_png_b64 = payload.pop("overlay_png_b64", None)
        overlay_png: Optional[bytes] = None
        if overlay_png_b64:
            overlay_png = base64.b64decode(overlay_png_b64)

        elapsed_ms = int((time.perf_counter() - started_at) * 1000)
        breakdown = payload.get("inference_breakdown") or {}
        breakdown["external_runtime"] = elapsed_ms
        payload["inference_ms"] = elapsed_ms
        payload["inference_breakdown"] = breakdown

        prediction = RawPrediction.model_validate(payload)
        prediction.overlay_png = overlay_png
        return prediction

    def warmup(self) -> None:
        return None

    def health_check(self) -> dict:
        return {
            "name": self.name,
            "ready": self.ready,
            "runtime_root": str(self.runtime_root),
            "weights_path": str(self.weights_path),
            "device": self.device,
            "model": f"{self.model_name}:{self.model_version}",
        }

    def close(self) -> None:
        self.ready = False
