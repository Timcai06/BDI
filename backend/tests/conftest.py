from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def isolate_runtime_env(monkeypatch, tmp_path):
    monkeypatch.setenv("BDI_ARTIFACT_ROOT", str(tmp_path / "artifacts"))
    monkeypatch.setenv("BDI_MODEL_VERSION", "mock-v1")
    monkeypatch.setenv("BDI_MODEL_BACKEND", "mock")
    monkeypatch.setenv("BDI_ALLOW_MOCK_FALLBACK", "true")
    monkeypatch.delenv("BDI_MODEL_WEIGHTS_PATH", raising=False)
    monkeypatch.delenv("BDI_EXTRA_MODELS", raising=False)
