import os
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field


class Settings(BaseModel):
    app_name: str = "bridge-defect-api"
    app_version: str = "0.1.0"
    artifact_root: Path = Field(default=Path("artifacts"))
    max_upload_size_bytes: int = 10 * 1024 * 1024
    model_name: str = "yolov8-seg"
    model_version: str = "v1"
    model_backend: str = "pytorch"
    model_weights_path: Optional[Path] = None
    model_device: str = "cpu"
    model_imgsz: int = 1280
    allow_mock_fallback: bool = True


def get_settings() -> Settings:
    weights_path = os.getenv("BDI_MODEL_WEIGHTS_PATH")
    return Settings(
        model_name=os.getenv("BDI_MODEL_NAME", "yolov8-seg"),
        model_version=os.getenv("BDI_MODEL_VERSION", "v1"),
        model_backend=os.getenv("BDI_MODEL_BACKEND", "pytorch"),
        model_weights_path=Path(weights_path) if weights_path else None,
        model_device=os.getenv("BDI_MODEL_DEVICE", "cpu"),
        model_imgsz=int(os.getenv("BDI_MODEL_IMGSZ", "1280")),
        allow_mock_fallback=os.getenv("BDI_ALLOW_MOCK_FALLBACK", "true").lower()
        in {"1", "true", "yes", "on"},
    )
