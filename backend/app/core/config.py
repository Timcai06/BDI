from __future__ import annotations

import json
import os
from getpass import getuser
from pathlib import Path
from typing import Literal, Optional

from dotenv import load_dotenv
from pydantic import BaseModel, Field

from app.core.category_mapper import normalize_defect_category

load_dotenv(Path(__file__).resolve().parents[2] / ".env")
BACKEND_ROOT = Path(__file__).resolve().parents[2]
WORKSPACE_ROOT = BACKEND_ROOT.parent


class ConfiguredModel(BaseModel):
    model_name: Optional[str] = None
    model_version: str
    backend: Optional[str] = None
    runner_kind: Optional[Literal["mock", "ultralytics", "external_ultralytics", "fusion"]] = None
    weights_path: Optional[Path] = None
    runtime_root: Optional[Path] = None
    device: Optional[str] = None
    imgsz: Optional[int] = None
    supports_masks: bool = True
    supports_overlay: bool = True
    supports_sliced_inference: bool = False
    primary_model_version: Optional[str] = None
    specialist_model_version: Optional[str] = None
    specialist_categories: list[str] = Field(default_factory=list)

    def model_post_init(self, __context) -> None:
        self.specialist_categories = [normalize_defect_category(category) for category in self.specialist_categories]


class Settings(BaseModel):
    app_name: str = "bridge-defect-api"
    app_version: str = "0.1.0"
    artifact_root: Path = Field(default=WORKSPACE_ROOT / "artifacts")
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
    enhance_enabled: bool = True
    enhance_revised_weights: Optional[Path] = Field(default=Path("models/enhancement/revised/best_psnr.pth"))
    enhance_bridge_weights: Optional[Path] = Field(default=Path("models/enhancement/bridge/best_psnr.pth"))
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
    database_url: str = f"postgresql+psycopg://{getuser()}@localhost:5432/bdi"
    database_echo: bool = False
    task_worker_enabled: bool = True
    task_worker_interval_seconds: float = 1.0
    task_lease_seconds: int = 300
    task_max_attempts: int = 3
    alert_auto_enabled: bool = True
    alert_count_threshold: int = 3
    alert_category_watchlist: list[str] = Field(default_factory=lambda: ["seepage"])
    alert_category_confidence_threshold: float = 0.8


def _env_flag(name: str, default: str) -> bool:
    return os.getenv(name, default).lower() in {"1", "true", "yes", "on"}


def _env_path(name: str) -> Path | None:
    value = os.getenv(name)
    return _resolve_runtime_path(Path(value)) if value else None


def _resolve_runtime_path(path: Path | None) -> Path | None:
    if path is None:
        return None
    if path.is_absolute():
        return path

    # Backward-compatible handling for values like "backend/models/..."
    # while allowing "models/..." relative to backend root.
    path_text = path.as_posix()
    if path_text.startswith("backend/"):
        return WORKSPACE_ROOT / path
    return BACKEND_ROOT / path


def _load_extra_models(raw_value: str | None) -> list[ConfiguredModel]:
    if not raw_value:
        return []

    return [
        ConfiguredModel(
            **{
                **item,
                "weights_path": _resolve_runtime_path(Path(item["weights_path"])) if item.get("weights_path") else None,
                "runtime_root": _resolve_runtime_path(Path(item["runtime_root"])) if item.get("runtime_root") else None,
            }
        )
        for item in json.loads(raw_value)
    ]


def _load_cors_origins(raw_value: str | None) -> list[str]:
    if raw_value:
        return [item.strip() for item in raw_value.split(",") if item.strip()]
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


def _load_category_watchlist(raw_value: str | None) -> list[str]:
    if raw_value:
        items = [normalize_defect_category(item.strip()) for item in raw_value.split(",") if item.strip()]
        if items:
            return items
    return ["seepage"]


def get_settings() -> Settings:
    cors_origins = os.getenv("BDI_CORS_ALLOW_ORIGINS")
    artifact_root = os.getenv("BDI_ARTIFACT_ROOT")
    extra_models_raw = os.getenv("BDI_EXTRA_MODELS")
    return Settings(
        artifact_root=_resolve_runtime_path(Path(artifact_root)) if artifact_root else (WORKSPACE_ROOT / "artifacts"),
        max_upload_size_bytes=int(os.getenv("BDI_MAX_UPLOAD_SIZE_BYTES", str(30 * 1024 * 1024))),
        model_name=os.getenv("BDI_MODEL_NAME", "yolov8-seg"),
        model_version=os.getenv("BDI_MODEL_VERSION", "v1"),
        active_model_version=os.getenv("BDI_ACTIVE_MODEL_VERSION"),
        model_backend=os.getenv("BDI_MODEL_BACKEND", "pytorch"),
        model_weights_path=_env_path("BDI_MODEL_WEIGHTS_PATH"),
        model_device=os.getenv("BDI_MODEL_DEVICE", "cpu"),
        model_imgsz=int(os.getenv("BDI_MODEL_IMGSZ", "1280")),
        model_supports_masks=_env_flag("BDI_MODEL_SUPPORTS_MASKS", "true"),
        model_supports_overlay=_env_flag("BDI_MODEL_SUPPORTS_OVERLAY", "true"),
        model_supports_sliced_inference=_env_flag("BDI_MODEL_SUPPORTS_SLICED_INFERENCE", "false"),
        pixels_per_mm=float(os.getenv("BDI_PIXELS_PER_MM", "10.0")),
        allow_mock_fallback=_env_flag("BDI_ALLOW_MOCK_FALLBACK", "true"),
        enhance_enabled=_env_flag("BDI_ENHANCE_ENABLED", "true"),
        enhance_revised_weights=_env_path("BDI_ENHANCE_REVISED_WEIGHTS")
        or _resolve_runtime_path(Path("models/enhancement/revised/best_psnr.pth")),
        enhance_bridge_weights=_env_path("BDI_ENHANCE_BRIDGE_WEIGHTS")
        or _resolve_runtime_path(Path("models/enhancement/bridge/best_psnr.pth")),
        extra_models=_load_extra_models(extra_models_raw),
        cors_allow_origins=_load_cors_origins(cors_origins),
        llm_api_key=os.getenv("BDI_LLM_API_KEY"),
        llm_base_url=os.getenv("BDI_LLM_BASE_URL", "https://api.openai.com/v1"),
        llm_model_name=os.getenv("BDI_LLM_MODEL_NAME", "gpt-3.5-turbo"),
        database_url=os.getenv(
            "BDI_DATABASE_URL",
            f"postgresql+psycopg://{getuser()}@localhost:5432/bdi",
        ),
        database_echo=_env_flag("BDI_DATABASE_ECHO", "false"),
        task_worker_enabled=_env_flag("BDI_TASK_WORKER_ENABLED", "true"),
        task_worker_interval_seconds=float(os.getenv("BDI_TASK_WORKER_INTERVAL_SECONDS", "1.0")),
        task_lease_seconds=max(30, int(os.getenv("BDI_TASK_LEASE_SECONDS", "300"))),
        task_max_attempts=int(os.getenv("BDI_TASK_MAX_ATTEMPTS", "3")),
        alert_auto_enabled=_env_flag("BDI_ALERT_AUTO_ENABLED", "true"),
        alert_count_threshold=int(os.getenv("BDI_ALERT_COUNT_THRESHOLD", "3")),
        alert_category_watchlist=_load_category_watchlist(os.getenv("BDI_ALERT_CATEGORY_WATCHLIST")),
        alert_category_confidence_threshold=float(os.getenv("BDI_ALERT_CATEGORY_CONFIDENCE_THRESHOLD", "0.8")),
    )
