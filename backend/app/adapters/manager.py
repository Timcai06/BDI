from __future__ import annotations

from typing import Dict, Optional

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
        self._runners: Dict[str, ModelRunner] = {}

    def resolve(self, version: str | None = None) -> tuple[ModelSpec, ModelRunner]:
        spec = self.registry.resolve_active(
            version,
            allow_fallback=self.allow_fallback,
        )

        if spec.model_version in self._runners:
            return spec, self._runners[spec.model_version]

        # Evict old runners if needed (basic policy: only keep 1 active runner to save memory)
        for old_version, runner in list(self._runners.items()):
            if old_version != spec.model_version:
                try:
                    runner.close()
                except Exception:
                    pass
                del self._runners[old_version]

        runner = load_runner_for_spec(spec)
        try:
            runner.warmup()
        except Exception:
            pass
            
        self._runners[spec.model_version] = runner
        return spec, runner

    def _resolve_spec(self, model_version: Optional[str]) -> ModelSpec:
        if model_version is None:
            return self.registry.resolve_active(allow_fallback=self.allow_fallback)

        return self.registry.get(model_version)
