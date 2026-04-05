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


def test_model_registry_registers_external_ultralytics_model(tmp_path: Path) -> None:
    weights_path = tmp_path / "main.pt"
    runtime_root = tmp_path / "runtime"
    weights_path.write_bytes(b"weights")
    runtime_root.mkdir()
    settings = Settings(
        extra_models=[
            ConfiguredModel(
                model_version="main-latest-mask-v1",
                backend="pytorch",
                runner_kind="external_ultralytics",
                weights_path=weights_path,
                runtime_root=runtime_root,
            )
        ]
    )

    registry = ModelRegistry.from_settings(settings)
    spec = registry.get("main-latest-mask-v1")

    assert spec.runner_kind == "external_ultralytics"
    assert spec.runtime_root == runtime_root
    assert spec.is_available is True


def test_model_registry_registers_fusion_model() -> None:
    settings = Settings(
        extra_models=[
            ConfiguredModel(
                model_version="v2-seepage-specialist",
                backend="pytorch",
                weights_path=Path("/tmp/seepage.pt"),
                supports_masks=False,
            ),
            ConfiguredModel(
                model_version="fusion-v1",
                model_name="dual-model-fusion",
                backend="fusion",
                runner_kind="fusion",
                primary_model_version="v1",
                specialist_model_version="v2-seepage-specialist",
                specialist_categories=["渗水"],
                supports_masks=False,
            ),
        ]
    )

    registry = ModelRegistry.from_settings(settings)
    fusion_spec = registry.get("fusion-v1")

    assert fusion_spec.runner_kind == "fusion"
    assert fusion_spec.primary_model_version == "v1"
    assert fusion_spec.specialist_model_version == "v2-seepage-specialist"
    assert fusion_spec.specialist_categories == ["seepage"]


def test_model_registry_uses_active_model_version_when_pointing_to_extra_model() -> None:
    settings = Settings(
        model_version="v1-general",
        active_model_version="fusion-v1",
        extra_models=[
            ConfiguredModel(
                model_version="fusion-v1",
                model_name="dual-model-fusion",
                backend="fusion",
                runner_kind="fusion",
                primary_model_version="v1-general",
                specialist_model_version="v2-seepage-specialist",
                specialist_categories=["seepage"],
                supports_masks=False,
            )
        ],
    )

    registry = ModelRegistry.from_settings(settings)

    assert registry.active_version == "fusion-v1"
