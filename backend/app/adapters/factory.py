from __future__ import annotations

import logging
from typing import Callable, Dict

from app.adapters.base import ModelRunner
from app.adapters.registry import ModelRegistry, ModelSpec
from app.core.config import Settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Runner registry – new runner kinds can be added via register_runner()
# without touching the if/elif chain.
# ---------------------------------------------------------------------------

RunnerFactory = Callable[..., ModelRunner]
_RUNNER_FACTORIES: Dict[str, RunnerFactory] = {}


def register_runner(kind: str, factory_fn: RunnerFactory) -> None:
    """Register a runner factory for a given ``runner_kind`` value."""
    _RUNNER_FACTORIES[kind] = factory_fn
    logger.debug("Registered runner factory: %s", kind)


# Built-in registrations ------------------------------------------------


def _create_mock(spec: ModelSpec, pixels_per_mm: float = 10.0) -> ModelRunner:
    from app.adapters.mock_runner import MockRunner

    return MockRunner()


def _create_ultralytics(spec: ModelSpec, pixels_per_mm: float = 10.0) -> ModelRunner:
    from app.adapters.ultralytics_runner import UltralyticsRunner

    return UltralyticsRunner.from_model_spec(spec, pixels_per_mm=pixels_per_mm)


def _create_external_ultralytics(spec: ModelSpec, pixels_per_mm: float = 10.0) -> ModelRunner:
    from app.adapters.external_ultralytics_runner import ExternalUltralyticsRunner

    return ExternalUltralyticsRunner.from_model_spec(spec, pixels_per_mm=pixels_per_mm)


register_runner("mock", _create_mock)
register_runner("ultralytics", _create_ultralytics)
register_runner("external_ultralytics", _create_external_ultralytics)


# Public API -------------------------------------------------------------


def load_runner_for_spec(spec: ModelSpec, pixels_per_mm: float = 10.0) -> ModelRunner:
    factory_fn = _RUNNER_FACTORIES.get(spec.runner_kind)
    if factory_fn is None:
        raise RuntimeError(
            f"Unsupported runner kind: {spec.runner_kind}. "
            f"Registered kinds: {sorted(_RUNNER_FACTORIES)}"
        )
    return factory_fn(spec, pixels_per_mm)


def load_runner(settings: Settings) -> ModelRunner:
    registry = ModelRegistry.from_settings(settings)
    active_spec = registry.resolve_active(allow_fallback=settings.allow_mock_fallback)
    pixels_per_mm = settings.pixels_per_mm

    try:
        return load_runner_for_spec(active_spec, pixels_per_mm)
    except Exception:
        if active_spec.runner_kind != "mock" and settings.allow_mock_fallback:
            return load_runner_for_spec(registry.get("mock-v1"), pixels_per_mm)
        raise
