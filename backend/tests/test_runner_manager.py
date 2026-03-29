from pathlib import Path

from app.adapters.manager import RunnerManager
from app.adapters.registry import ModelRegistry
from app.adapters.fusion_runner import FusionRunner
from app.adapters.mock_runner import MockRunner
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


def test_runner_manager_falls_back_when_primary_load_raises(tmp_path: Path, monkeypatch) -> None:
    weights_path = tmp_path / "model.pt"
    weights_path.write_bytes(b"fake-weights")

    settings = Settings(
        model_version="v2-real",
        model_weights_path=weights_path,
        allow_mock_fallback=True,
    )
    registry = ModelRegistry.from_settings(settings)
    manager = RunnerManager(registry=registry, allow_fallback=True)

    def fake_load_runner_for_spec(spec):
        if spec.runner_kind == "ultralytics":
            raise RuntimeError("load failed")
        return MockRunner()

    monkeypatch.setattr("app.adapters.manager.load_runner_for_spec", fake_load_runner_for_spec)

    spec, runner = manager.resolve()

    assert spec.model_version == "mock-v1"
    assert runner.name == "mock-runner"


def test_runner_manager_uses_lru_eviction_policy(monkeypatch) -> None:
    settings = Settings(
        model_version="v1",
        extra_models=[
            ConfiguredModel(model_version="mock-v2", backend="mock", runner_kind="mock"),
            ConfiguredModel(model_version="mock-v3", backend="mock", runner_kind="mock"),
        ],
        allow_mock_fallback=True,
    )
    registry = ModelRegistry.from_settings(settings)
    manager = RunnerManager(registry=registry, allow_fallback=True, max_cached_runners=2)

    class FakeRunner:
        def __init__(self, name: str) -> None:
            self.name = name
            self.closed = False

        def warmup(self) -> None:
            return None

        def close(self) -> None:
            self.closed = True

    created: dict[str, FakeRunner] = {}

    def fake_load_runner_for_spec(spec):
        runner = FakeRunner(name=f"runner-{spec.model_version}")
        created[spec.model_version] = runner
        return runner

    monkeypatch.setattr("app.adapters.manager.load_runner_for_spec", fake_load_runner_for_spec)

    manager.resolve("mock-v1")
    manager.resolve("mock-v2")
    # Touch mock-v1 so mock-v2 becomes least recently used.
    manager.resolve("mock-v1")
    manager.resolve("mock-v3")

    assert created["mock-v2"].closed is True
    assert created["mock-v1"].closed is False
    assert created["mock-v3"].closed is False
    assert list(manager._runners.keys()) == ["mock-v1", "mock-v3"]


def test_runner_manager_builds_fusion_runner() -> None:
    settings = Settings(
        model_version="v1-general",
        model_backend="pytorch",
        model_weights_path=Path("/tmp/general.pt"),
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
                primary_model_version="v1-general",
                specialist_model_version="v2-seepage-specialist",
                specialist_categories=["seepage"],
                supports_masks=False,
            ),
        ],
        allow_mock_fallback=False,
    )
    registry = ModelRegistry.from_settings(settings)
    manager = RunnerManager(registry=registry, allow_fallback=False)

    spec, runner = manager.resolve("fusion-v1")

    assert spec.model_version == "fusion-v1"
    assert isinstance(runner, FusionRunner)
