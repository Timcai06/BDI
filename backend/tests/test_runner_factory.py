from pathlib import Path

import pytest

from app.adapters.factory import load_runner
from app.adapters.mock_runner import MockRunner
from app.core.config import Settings


def test_load_runner_returns_mock_when_weights_are_missing() -> None:
    settings = Settings(model_weights_path=Path("/tmp/does-not-exist.pt"))

    runner = load_runner(settings)

    assert isinstance(runner, MockRunner)


def test_load_runner_raises_when_mock_fallback_is_disabled() -> None:
    settings = Settings(
        model_weights_path=Path("/tmp/does-not-exist.pt"),
        allow_mock_fallback=False,
    )

    with pytest.raises(RuntimeError):
        load_runner(settings)
