from pathlib import Path

from app.adapters.manager import RunnerManager
from app.adapters.registry import ModelRegistry
from app.core.config import ConfiguredModel, Settings


def test_runner_manager_resolves_requested_registered_mock_model() -> None:
    settings = Settings(
        model_version="v1",
        extra_models=[
            ConfiguredModel(
                model_version="mock-v2",
                backend="mock",
                runner_kind="mock",
            )
        ],
    )
    registry = ModelRegistry.from_settings(settings)
    manager = RunnerManager(registry=registry, allow_fallback=True)

    spec, runner = manager.resolve("mock-v2")

    assert spec.model_version == "mock-v2"
    assert runner.name == "mock-runner"


def test_runner_manager_caches_runner_instances() -> None:
    settings = Settings()
    registry = ModelRegistry.from_settings(settings)
    manager = RunnerManager(registry=registry, allow_fallback=True)

    first_spec, first_runner = manager.resolve("mock-v1")
    second_spec, second_runner = manager.resolve("mock-v1")

    assert first_spec.model_version == second_spec.model_version
    assert first_runner is second_runner


def test_runner_manager_uses_active_fallback_when_primary_is_unavailable() -> None:
    settings = Settings(
        model_version="v2-real",
        model_weights_path=Path("/tmp/missing.pt"),
        allow_mock_fallback=True,
    )
    registry = ModelRegistry.from_settings(settings)
    manager = RunnerManager(registry=registry, allow_fallback=True)

    spec, runner = manager.resolve()

    assert spec.model_version == "mock-v1"
    assert runner.name == "mock-runner"
