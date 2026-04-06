from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from app.core.config import ConfiguredModel, Settings


class ModelSpec(BaseModel):
    model_name: str
    model_version: str
    backend: str
    runner_kind: Literal["mock", "ultralytics", "external_ultralytics", "fusion"]
    weights_path: Optional[Path] = None
    runtime_root: Optional[Path] = None
    device: str = "cpu"
    imgsz: int = 1280
    supports_masks: bool = True
    supports_overlay: bool = True
    supports_sliced_inference: bool = False
    primary_model_version: Optional[str] = None
    specialist_model_version: Optional[str] = None
    specialist_categories: List[str] = Field(default_factory=list)

    @property
    def is_available(self) -> bool:
        if self.runner_kind == "mock":
            return True
        if self.runner_kind == "fusion":
            return (
                self.primary_model_version is not None
                and self.specialist_model_version is not None
                and bool(self.specialist_categories)
            )
        if self.runner_kind == "external_ultralytics":
            return (
                self.weights_path is not None
                and self.weights_path.exists()
                and self.runtime_root is not None
                and self.runtime_root.exists()
            )
        return self.weights_path is not None and self.weights_path.exists()


class ModelRegistry(BaseModel):
    active_version: str
    specs: Dict[str, ModelSpec] = Field(default_factory=dict)

    def register(self, spec: ModelSpec, *, make_active: bool = False) -> None:
        self.specs[spec.model_version] = spec
        if make_active:
            self.active_version = spec.model_version

    def get(self, model_version: str) -> ModelSpec:
        if model_version not in self.specs:
            raise KeyError(f"Unknown model version: {model_version}")
        return self.specs[model_version]

    def get_active(self) -> ModelSpec:
        return self.get(self.active_version)

    def list_specs(self) -> List[ModelSpec]:
        return list(self.specs.values())

    def resolve_active(
        self,
        model_version: Optional[str] = None,
        *,
        allow_fallback: bool,
    ) -> ModelSpec:
        try:
            target_spec = self.get(model_version) if model_version else self.get_active()
            if target_spec.is_available:
                return target_spec
        except KeyError:
            # If a specific version was requested but not found, don't fallback
            if model_version or not allow_fallback:
                raise

        if allow_fallback:
            for spec in self.specs.values():
                if spec.runner_kind == "mock" and spec.is_available:
                    return spec

        requested = model_version or self.active_version
        raise RuntimeError(f"Requested model version '{requested}' is unavailable and no fallback runner is enabled.")

    @classmethod
    def from_settings(cls, settings: Settings) -> "ModelRegistry":
        active_version = settings.active_model_version or settings.model_version
        registry = cls(active_version=active_version)
        registry.register(cls._build_primary_spec(settings))

        for configured_model in settings.extra_models:
            registry.register(cls._build_extra_spec(settings, configured_model))

        if active_version not in registry.specs:
            registry.active_version = settings.model_version

        if settings.allow_mock_fallback:
            registry.register(
                ModelSpec(
                    model_name=settings.model_name,
                    model_version="mock-v1",
                    backend="mock",
                    runner_kind="mock",
                    device=settings.model_device,
                    imgsz=settings.model_imgsz,
                    supports_masks=True,
                    supports_overlay=True,
                    supports_sliced_inference=True,
                )
            )

        return registry

    @staticmethod
    def _build_primary_spec(settings: Settings) -> ModelSpec:
        return ModelRegistry._build_spec(
            model_name=settings.model_name,
            model_version=settings.model_version,
            backend=settings.model_backend,
            runner_kind="ultralytics",
            weights_path=settings.model_weights_path,
            device=settings.model_device,
            imgsz=settings.model_imgsz,
            supports_masks=settings.model_supports_masks,
            supports_overlay=settings.model_supports_overlay,
            supports_sliced_inference=settings.model_supports_sliced_inference,
        )

    @staticmethod
    def _build_extra_spec(settings: Settings, configured_model: ConfiguredModel) -> ModelSpec:
        runner_kind = configured_model.runner_kind
        if runner_kind is None:
            runner_kind = "mock" if configured_model.backend == "mock" else "ultralytics"

        return ModelRegistry._build_spec(
            model_name=configured_model.model_name or settings.model_name,
            model_version=configured_model.model_version,
            backend=configured_model.backend or settings.model_backend,
            runner_kind=runner_kind,
            weights_path=configured_model.weights_path,
            runtime_root=configured_model.runtime_root,
            device=configured_model.device or settings.model_device,
            imgsz=configured_model.imgsz or settings.model_imgsz,
            supports_masks=configured_model.supports_masks,
            supports_overlay=configured_model.supports_overlay,
            supports_sliced_inference=configured_model.supports_sliced_inference,
            primary_model_version=configured_model.primary_model_version,
            specialist_model_version=configured_model.specialist_model_version,
            specialist_categories=configured_model.specialist_categories,
        )

    @staticmethod
    def _build_spec(
        *,
        model_name: str,
        model_version: str,
        backend: str,
        runner_kind: Literal["mock", "ultralytics", "external_ultralytics", "fusion"],
        weights_path: Optional[Path] = None,
        runtime_root: Optional[Path] = None,
        device: str = "cpu",
        imgsz: int = 1280,
        supports_masks: bool = True,
        supports_overlay: bool = True,
        supports_sliced_inference: bool = False,
        primary_model_version: Optional[str] = None,
        specialist_model_version: Optional[str] = None,
        specialist_categories: Optional[List[str]] = None,
    ) -> ModelSpec:
        return ModelSpec(
            model_name=model_name,
            model_version=model_version,
            backend=backend,
            runner_kind=runner_kind,
            weights_path=weights_path,
            runtime_root=runtime_root,
            device=device,
            imgsz=imgsz,
            supports_masks=supports_masks,
            supports_overlay=supports_overlay,
            supports_sliced_inference=supports_sliced_inference,
            primary_model_version=primary_model_version,
            specialist_model_version=specialist_model_version,
            specialist_categories=specialist_categories or [],
        )
