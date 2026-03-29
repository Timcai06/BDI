from __future__ import annotations

from pathlib import Path

from app.core.config import get_settings


def test_get_settings_parses_boolean_and_path_flags(monkeypatch) -> None:
    monkeypatch.setenv("BDI_MODEL_WEIGHTS_PATH", "/tmp/model.pt")
    monkeypatch.setenv("BDI_MODEL_SUPPORTS_MASKS", "off")
    monkeypatch.setenv("BDI_MODEL_SUPPORTS_OVERLAY", "yes")
    monkeypatch.setenv("BDI_MODEL_SUPPORTS_SLICED_INFERENCE", "1")
    monkeypatch.setenv("BDI_ALLOW_MOCK_FALLBACK", "0")

    settings = get_settings()

    assert settings.model_weights_path == Path("/tmp/model.pt")
    assert settings.model_supports_masks is False
    assert settings.model_supports_overlay is True
    assert settings.model_supports_sliced_inference is True
    assert settings.allow_mock_fallback is False


def test_get_settings_parses_extra_models_and_cors_origins(monkeypatch) -> None:
    monkeypatch.setenv(
        "BDI_EXTRA_MODELS",
        '[{"model_version":"fusion-v1","backend":"fusion","runner_kind":"fusion","specialist_categories":["渗水"]}]',
    )
    monkeypatch.setenv("BDI_CORS_ALLOW_ORIGINS", "http://localhost:3000, http://127.0.0.1:3000")

    settings = get_settings()

    assert len(settings.extra_models) == 1
    assert settings.extra_models[0].model_version == "fusion-v1"
    assert settings.extra_models[0].specialist_categories == ["seepage"]
    assert settings.cors_allow_origins == [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
