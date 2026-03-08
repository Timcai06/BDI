from __future__ import annotations

from app.adapters.base import ModelRunner
from app.adapters.mock_runner import MockRunner
from app.core.config import Settings


def load_runner(settings: Settings) -> ModelRunner:
    if settings.model_weights_path and settings.model_weights_path.exists():
        try:
            from app.adapters.ultralytics_runner import UltralyticsRunner

            return UltralyticsRunner.from_settings(settings)
        except Exception:
            if not settings.allow_mock_fallback:
                raise

    if settings.allow_mock_fallback:
        return MockRunner()

    raise RuntimeError(
        "BDI_MODEL_WEIGHTS_PATH is not configured or does not exist, and mock fallback is disabled."
    )
