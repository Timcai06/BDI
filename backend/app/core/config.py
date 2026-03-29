import json
import os
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel, Field
from dotenv import load_dotenv

from app.core.category_mapper import normalize_defect_category


load_dotenv(Path(__file__).resolve().parents[2] / ".env")


class ConfiguredModel(BaseModel):
    model_name: Optional[str] = None
    model_version: str
    backend: Optional[str] = None
    runner_kind: Optional[Literal["mock", "ultralytics", "fusion"]] = None
    weights_path: Optional[Path] = None
    device: Optional[str] = None
    imgsz: Optional[int] = None
    supports_masks: bool = True
    supports_overlay: bool = True
    supports_sliced_inference: bool = False
    primary_model_version: Optional[str] = None
    specialist_model_version: Optional[str] = None
    specialist_categories: list[str] = Field(default_factory=list)

    def model_post_init(self, __context) -> None:
        self.specialist_categories = [
            normalize_defect_category(category) for category in self.specialist_categories
        ]


class Settings(BaseModel):
    app_name: str = "bridge-defect-api"
    app_version: str = "0.1.0"
    artifact_root: Path = Field(default=Path("artifacts"))
    max_upload_size_bytes: int = 30 * 1024 * 1024
    model_name: str = "yolov8-seg"
    model_version: str = "v1"
    active_model_version: Optional[str] = None
    model_backend: str = "pytorch"
    model_weights_path: Optional[Path] = None
    model_device: str = "cpu"
    model_imgsz: int = 1280
    model_supports_masks: bool = True
    model_supports_overlay: bool = True
    model_supports_sliced_inference: bool = False
    pixels_per_mm: float = Field(default=10.0, description="Pixel to millimeter conversion factor")
    allow_mock_fallback: bool = True
    extra_models: list[ConfiguredModel] = Field(default_factory=list)
    cors_allow_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    )
    llm_api_key: Optional[str] = None
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model_name: str = "gpt-3.5-turbo"


def get_settings() -> Settings:
    cors_origins = os.getenv("BDI_CORS_ALLOW_ORIGINS")
    weights_path = os.getenv("BDI_MODEL_WEIGHTS_PATH")
    artifact_root = os.getenv("BDI_ARTIFACT_ROOT")
    extra_models_raw = os.getenv("BDI_EXTRA_MODELS")
    return Settings(
        artifact_root=Path(artifact_root) if artifact_root else Path("artifacts"),
        max_upload_size_bytes=int(os.getenv("BDI_MAX_UPLOAD_SIZE_BYTES", str(30 * 1024 * 1024))),
        model_name=os.getenv("BDI_MODEL_NAME", "yolov8-seg"),
        model_version=os.getenv("BDI_MODEL_VERSION", "v1"),
        active_model_version=os.getenv("BDI_ACTIVE_MODEL_VERSION"),
        model_backend=os.getenv("BDI_MODEL_BACKEND", "pytorch"),
        model_weights_path=Path(weights_path) if weights_path else None,
        model_device=os.getenv("BDI_MODEL_DEVICE", "cpu"),
        model_imgsz=int(os.getenv("BDI_MODEL_IMGSZ", "1280")),
        model_supports_masks=os.getenv("BDI_MODEL_SUPPORTS_MASKS", "true").lower()
        in {"1", "true", "yes", "on"},
        model_supports_overlay=os.getenv("BDI_MODEL_SUPPORTS_OVERLAY", "true").lower()
        in {"1", "true", "yes", "on"},
        model_supports_sliced_inference=os.getenv(
            "BDI_MODEL_SUPPORTS_SLICED_INFERENCE", "false"
        ).lower()
        in {"1", "true", "yes", "on"},
        pixels_per_mm=float(os.getenv("BDI_PIXELS_PER_MM", "10.0")),
        allow_mock_fallback=os.getenv("BDI_ALLOW_MOCK_FALLBACK", "true").lower()
        in {"1", "true", "yes", "on"},
        extra_models=[
            ConfiguredModel(
                **{
                    **item,
                    "weights_path": Path(item["weights_path"])
                    if item.get("weights_path")
                    else None,
                }
            )
            for item in json.loads(extra_models_raw)
        ]
        if extra_models_raw
        else [],
        cors_allow_origins=[item.strip() for item in cors_origins.split(",") if item.strip()]
        if cors_origins
        else [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
        llm_api_key=os.getenv("BDI_LLM_API_KEY"),
        llm_base_url=os.getenv("BDI_LLM_BASE_URL", "https://api.openai.com/v1"),
        llm_model_name=os.getenv("BDI_LLM_MODEL_NAME", "gpt-3.5-turbo"),
    )
