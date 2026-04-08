from __future__ import annotations

from pathlib import PurePosixPath
from typing import Optional

from fastapi import UploadFile, status

from app.core.errors import AppError

ALLOWED_ENHANCEMENT_MODES = {"off", "auto", "always"}
DEFAULT_MODEL_POLICIES = {
    "active-default",
    "active",
    "fusion-default",
    "seepage-priority",
    "general-only",
}


def resolve_requested_model_version(service, model_policy: str) -> Optional[str]:
    if service.runner_manager is None:
        return None

    registry = service.runner_manager.registry
    policy = (model_policy or "").strip().lower()
    if not policy or policy in {"active-default", "active"}:
        return registry.active_version
    if policy in {"fusion-default", "seepage-priority"}:
        active_spec = registry.get_active()
        if active_spec.runner_kind == "fusion":
            return active_spec.model_version
        for spec in registry.list_specs():
            if spec.runner_kind == "fusion":
                return spec.model_version
        return registry.active_version
    if policy == "general-only":
        active_spec = registry.get_active()
        if active_spec.runner_kind == "fusion" and active_spec.primary_model_version:
            return active_spec.primary_model_version
        for spec in registry.list_specs():
            if spec.runner_kind in {"ultralytics", "external_ultralytics"}:
                return spec.model_version
        return registry.active_version
    if policy in registry.specs:
        return policy
    return registry.active_version


def validate_model_policy(service, model_policy: str) -> str:
    policy = (model_policy or "").strip().lower()
    if not policy:
        raise AppError(
            code="INVALID_MODEL_POLICY",
            message="Model policy must not be empty.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    if policy in DEFAULT_MODEL_POLICIES:
        return policy

    if service.runner_manager is not None and policy in service.runner_manager.registry.specs:
        return policy

    raise AppError(
        code="INVALID_MODEL_POLICY",
        message="Model policy is not supported.",
        status_code=status.HTTP_400_BAD_REQUEST,
        details={"model_policy": model_policy},
    )


def validate_enhancement_mode(enhancement_mode: str) -> str:
    mode = (enhancement_mode or "").strip().lower()
    if mode not in ALLOWED_ENHANCEMENT_MODES:
        raise AppError(
            code="INVALID_ENHANCEMENT_MODE",
            message="Enhancement mode must be one of off, auto, or always.",
            status_code=status.HTTP_400_BAD_REQUEST,
            details={"enhancement_mode": enhancement_mode},
        )
    return mode


def normalize_relative_path(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized = value.strip().replace("\\", "/")
    if not normalized:
        return None
    parts = [part for part in PurePosixPath(normalized).parts if part not in ("", ".")]
    if not parts or any(part == ".." for part in parts):
        return None
    return "/".join(parts)[:1024]


def validate_relative_paths(*, files: list[UploadFile], relative_paths: Optional[list[str]]) -> None:
    if relative_paths is None:
        return

    if len(relative_paths) != len(files):
        raise AppError(
            code="RELATIVE_PATH_COUNT_MISMATCH",
            message="relative_paths must match the number of uploaded files.",
            status_code=status.HTTP_400_BAD_REQUEST,
            details={"files": len(files), "relative_paths": len(relative_paths)},
        )

    for index, value in enumerate(relative_paths):
        normalized = normalize_relative_path(value)
        if normalized is None:
            raise AppError(
                code="INVALID_RELATIVE_PATH",
                message="relative_paths contains an invalid or unsafe path.",
                status_code=status.HTTP_400_BAD_REQUEST,
                details={"index": index, "relative_path": value},
            )
