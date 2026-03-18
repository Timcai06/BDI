from pathlib import Path

import pytest

from app.adapters import factory
from app.adapters.mock_runner import MockRunner
from app.core.config import Settings


def test_load_runner_returns_mock_when_weights_are_missing() -> None:
    settings = Settings(model_weights_path=Path("/tmp/does-not-exist.pt"))

    runner = factory.load_runner(settings)

    assert isinstance(runner, MockRunner)


def test_load_runner_raises_when_mock_fallback_is_disabled() -> None:
    settings = Settings(
        model_weights_path=Path("/tmp/does-not-exist.pt"),
        allow_mock_fallback=False,
    )

    with pytest.raises(RuntimeError):
        factory.load_runner(settings)


def test_load_runner_uses_active_model_spec(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    weights_path = tmp_path / "model.pt"
    weights_path.write_bytes(b"fake-weights")
    settings = Settings(
        model_version="v2-real",
        model_weights_path=weights_path,
        allow_mock_fallback=False,
    )
    captured: dict[str, str] = {}

    class StubRunner:
        name = "stub-runner"
        ready = True

    def fake_load_runner_for_spec(spec, pixels_per_mm=10.0):  # type: ignore[no-untyped-def]
        captured["model_version"] = spec.model_version
        return StubRunner()

    monkeypatch.setattr(factory, "load_runner_for_spec", fake_load_runner_for_spec)

    runner = factory.load_runner(settings)

    assert runner.name == "stub-runner"
    assert captured["model_version"] == "v2-real"
