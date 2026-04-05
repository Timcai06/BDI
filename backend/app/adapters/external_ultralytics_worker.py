from __future__ import annotations

import argparse
import base64
import io
import json
import sys
from pathlib import Path

from PIL import Image

from app.adapters.output_adapter import UltralyticsOutputAdapter


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a vendored ultralytics model in isolation.")
    parser.add_argument("--runtime-root", required=True)
    parser.add_argument("--weights", required=True)
    parser.add_argument("--image", required=True)
    parser.add_argument("--confidence", type=float, required=True)
    parser.add_argument("--iou", type=float, required=True)
    parser.add_argument("--imgsz", type=int, required=True)
    parser.add_argument("--device", required=True)
    parser.add_argument("--pixels-per-mm", type=float, required=True)
    parser.add_argument("--model-name", required=True)
    parser.add_argument("--model-version", required=True)
    parser.add_argument("--backend", required=True)
    parser.add_argument("--inference-mode", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--return-overlay", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    runtime_root = Path(args.runtime_root).resolve()
    sys.path.insert(0, str(runtime_root))

    from ultralytics import YOLO  # type: ignore

    image = Image.open(args.image)
    model = YOLO(str(Path(args.weights).resolve()))
    results = model.predict(
        source=image,
        conf=args.confidence,
        iou=args.iou,
        imgsz=args.imgsz,
        device=args.device,
        verbose=False,
    )
    result = results[0]
    detections = UltralyticsOutputAdapter(pixels_per_mm=args.pixels_per_mm).adapt(
        result,
        pixels_per_mm=args.pixels_per_mm,
    )

    overlay_b64: str | None = None
    if args.return_overlay:
        plotted = result.plot()
        overlay_image = Image.fromarray(plotted[:, :, ::-1])
        buffer = io.BytesIO()
        overlay_image.save(buffer, format="WEBP", quality=85)
        overlay_b64 = base64.b64encode(buffer.getvalue()).decode("ascii")

    payload = {
        "model_name": args.model_name,
        "model_version": args.model_version,
        "backend": args.backend,
        "inference_mode": args.inference_mode,
        "inference_ms": 0,
        "inference_breakdown": {},
        "detections": [detection.model_dump(mode="json") for detection in detections],
        "metadata": {
            "weights_path": str(Path(args.weights).resolve()),
            "runtime_root": str(runtime_root),
            "device": args.device,
            "source_image": Path(args.image).name,
        },
        "overlay_png_b64": overlay_b64,
    }
    Path(args.output).write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
