from __future__ import annotations

import io
from types import SimpleNamespace

import pytest
from fastapi import UploadFile

from app.core.errors import AppError
from app.services.batch_validation_service import (
    normalize_relative_path,
    resolve_requested_model_version,
    validate_enhancement_mode,
    validate_model_policy,
    validate_relative_paths,
)


def _make_runner_manager():
    specs = {
        "fusion-main": SimpleNamespace(model_version="fusion-main", runner_kind="fusion", primary_model_version="main-v1"),
        "main-v1": SimpleNamespace(model_version="main-v1", runner_kind="external_ultralytics", primary_model_version=None),
    }
    registry = SimpleNamespace(
        active_version="fusion-main",
        specs=specs,
        get_active=lambda: specs["fusion-main"],
        list_specs=lambda: list(specs.values()),
    )
    return SimpleNamespace(registry=registry)


def test_validate_model_policy_accepts_registry_version() -> None:
    service = SimpleNamespace(runner_manager=_make_runner_manager())
    assert validate_model_policy(service, "main-v1") == "main-v1"


def test_validate_model_policy_rejects_unknown_policy() -> None:
    service = SimpleNamespace(runner_manager=_make_runner_manager())
    with pytest.raises(AppError) as exc:
        validate_model_policy(service, "unknown-model")
    assert exc.value.code == "INVALID_MODEL_POLICY"


def test_validate_enhancement_mode_rejects_invalid_mode() -> None:
    with pytest.raises(AppError) as exc:
        validate_enhancement_mode("invalid-mode")
    assert exc.value.code == "INVALID_ENHANCEMENT_MODE"


def test_resolve_requested_model_version_uses_general_only_primary() -> None:
    service = SimpleNamespace(runner_manager=_make_runner_manager())
    assert resolve_requested_model_version(service, "general-only") == "main-v1"


def test_normalize_relative_path_rejects_parent_escape() -> None:
    assert normalize_relative_path("../unsafe.jpg") is None


def test_validate_relative_paths_rejects_mismatch() -> None:
    upload = UploadFile(filename="a.jpg", file=io.BytesIO(b"test"))
    with pytest.raises(AppError) as exc:
        validate_relative_paths(files=[upload], relative_paths=[])
    assert exc.value.code == "RELATIVE_PATH_COUNT_MISMATCH"
