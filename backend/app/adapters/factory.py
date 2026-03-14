from __future__ import annotations

from app.adapters.base import ModelRunner
from app.adapters.mock_runner import MockRunner
from app.adapters.registry import ModelRegistry, ModelSpec
from app.core.config import Settings


def load_runner_for_spec(spec: ModelSpec) -> ModelRunner:
    if spec.runner_kind == "mock":
        return MockRunner()

    if spec.runner_kind == "ultralytics":
        from app.adapters.ultralytics_runner import UltralyticsRunner

        return UltralyticsRunner.from_model_spec(spec)

    raise RuntimeError(f"Unsupported runner kind: {spec.runner_kind}")


def load_runner(settings: Settings) -> ModelRunner:
    registry = ModelRegistry.from_settings(settings)
    active_spec = registry.resolve_active(allow_fallback=settings.allow_mock_fallback)

    try:
        return load_runner_for_spec(active_spec)
    except Exception:
        if active_spec.runner_kind != "mock" and settings.allow_mock_fallback:
            return load_runner_for_spec(registry.get("mock-v1"))
        raise
