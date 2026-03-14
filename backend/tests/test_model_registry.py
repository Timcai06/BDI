from pathlib import Path

import pytest

from app.adapters.registry import ModelRegistry, ModelSpec
from app.core.config import ConfiguredModel, Settings


def test_model_registry_from_settings_registers_primary_and_mock_specs() -> None:
    settings = Settings(
        model_name="bridge-seg",
        model_version="v2",
        model_backend="pytorch",
        model_weights_path=Path("/tmp/missing.pt"),
        allow_mock_fallback=True,
    )

    registry = ModelRegistry.from_settings(settings)

    assert registry.active_version == "v2"
    assert registry.get("v2").runner_kind == "ultralytics"
    assert registry.get("mock-v1").runner_kind == "mock"


def test_model_registry_resolves_mock_when_primary_spec_is_unavailable() -> None:
    settings = Settings(
        model_version="v2",
        model_weights_path=Path("/tmp/missing.pt"),
        allow_mock_fallback=True,
    )

    registry = ModelRegistry.from_settings(settings)

    resolved = registry.resolve_active(allow_fallback=True)

    assert resolved.model_version == "mock-v1"
    assert resolved.runner_kind == "mock"


def test_model_registry_keeps_primary_when_weights_exist(tmp_path: Path) -> None:
    weights_path = tmp_path / "model.pt"
    weights_path.write_bytes(b"fake-weights")
    settings = Settings(
        model_version="v3",
        model_weights_path=weights_path,
        allow_mock_fallback=False,
    )

    registry = ModelRegistry.from_settings(settings)

    resolved = registry.resolve_active(allow_fallback=False)

    assert resolved.model_version == "v3"
    assert resolved.weights_path == weights_path


def test_model_registry_raises_for_unknown_model_version() -> None:
    registry = ModelRegistry(active_version="v1")
    registry.register(
        ModelSpec(
            model_name="yolov8-seg",
            model_version="v1",
            backend="pytorch",
            runner_kind="ultralytics",
            weights_path=Path("/tmp/missing.pt"),
        ),
        make_active=True,
    )

    with pytest.raises(KeyError):
        registry.get("v9")


def test_model_registry_registers_extra_models() -> None:
    settings = Settings(
        extra_models=[
            ConfiguredModel(
                model_version="mock-v2",
                backend="mock",
                runner_kind="mock",
            )
        ]
    )

    registry = ModelRegistry.from_settings(settings)

    assert registry.get("mock-v2").runner_kind == "mock"
