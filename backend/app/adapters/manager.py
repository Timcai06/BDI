from __future__ import annotations

from typing import Dict, Optional, Tuple

from app.adapters.base import ModelRunner
from app.adapters.factory import load_runner_for_spec
from app.adapters.registry import ModelRegistry, ModelSpec


class RunnerManager:
    def __init__(
        self,
        *,
        registry: ModelRegistry,
        allow_fallback: bool,
    ) -> None:
        self.registry = registry
        self.allow_fallback = allow_fallback
        self._runner_cache: Dict[str, ModelRunner] = {}

    def resolve(
        self, model_version: Optional[str] = None
    ) -> Tuple[ModelSpec, ModelRunner]:
        spec = self._resolve_spec(model_version)
        if spec.model_version not in self._runner_cache:
            self._runner_cache[spec.model_version] = load_runner_for_spec(spec)
        return spec, self._runner_cache[spec.model_version]

    def _resolve_spec(self, model_version: Optional[str]) -> ModelSpec:
        if model_version is None:
            return self.registry.resolve_active(allow_fallback=self.allow_fallback)

        return self.registry.get(model_version)
