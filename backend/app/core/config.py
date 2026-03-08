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
    cors_allow_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    )


def get_settings() -> Settings:
    cors_origins = os.getenv("BDI_CORS_ALLOW_ORIGINS")
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
        cors_allow_origins=[
            item.strip()
            for item in cors_origins.split(",")
            if item.strip()
        ]
        if cors_origins
        else [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
    )
