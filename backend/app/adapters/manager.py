from __future__ import annotations

import logging
import time
from collections import OrderedDict
from typing import Any

from app.adapters.base import ModelRunner
from app.adapters.factory import load_runner_for_spec
from app.adapters.fusion_runner import FusionRunner
from app.adapters.registry import ModelRegistry, ModelSpec

logger = logging.getLogger(__name__)


class RunnerManager:
    def __init__(
        self,
        *,
        registry: ModelRegistry,
        allow_fallback: bool,
        max_cached_runners: int = 2,
        pixels_per_mm: float = 10.0,
    ) -> None:
        self.registry = registry
        self.allow_fallback = allow_fallback
        self.max_cached_runners = max(1, max_cached_runners)
        self.pixels_per_mm = pixels_per_mm
        self._runners: OrderedDict[str, ModelRunner] = OrderedDict()
        self.last_resolution: dict[str, Any] = {}

    def resolve(self, version: str | None = None) -> tuple[ModelSpec, ModelRunner]:
        start = time.perf_counter()
        requested_version = version
        fallback_from: str | None = None

        spec = self.registry.resolve_active(
            version,
            allow_fallback=self.allow_fallback,
        )

        runner = self._get_cached_runner(spec.model_version)
        if runner is not None:
            self._record_resolution(
                requested_version=requested_version,
                resolved_version=spec.model_version,
                fallback_from=fallback_from,
                cache_hit=True,
                load_ms=int((time.perf_counter() - start) * 1000),
            )
            return spec, runner

        try:
            runner = self._load_runner(spec)
        except Exception as exc:
            if not self.allow_fallback or spec.runner_kind == "mock":
                raise

            logger.warning(
                "Runner load failed for %s, falling back to mock-v1: %s",
                spec.model_version,
                exc,
                exc_info=True,
            )
            fallback_from = spec.model_version
            fallback_spec = self.registry.get("mock-v1")
            spec = fallback_spec
            runner = self._get_cached_runner(spec.model_version)
            if runner is not None:
                self._record_resolution(
                    requested_version=requested_version,
                    resolved_version=spec.model_version,
                    fallback_from=fallback_from,
                    cache_hit=True,
                    load_ms=int((time.perf_counter() - start) * 1000),
                )
                return spec, runner

            runner = self._load_runner(spec)

        try:
            runner.warmup()
        except Exception:
            pass

        self._store_runner(spec.model_version, runner)
        self._record_resolution(
            requested_version=requested_version,
            resolved_version=spec.model_version,
            fallback_from=fallback_from,
            cache_hit=False,
            load_ms=int((time.perf_counter() - start) * 1000),
        )
        return spec, runner

    def _load_runner(self, spec: ModelSpec) -> ModelRunner:
        if spec.runner_kind == "fusion":
            return FusionRunner(
                spec=spec,
                registry=self.registry,
                pixels_per_mm=self.pixels_per_mm,
            )
        return load_runner_for_spec(spec)

    def _get_cached_runner(self, model_version: str) -> ModelRunner | None:
        runner = self._runners.get(model_version)
        if runner is not None:
            self._runners.move_to_end(model_version, last=True)
        return runner

    def _store_runner(self, model_version: str, runner: ModelRunner) -> None:
        self._runners[model_version] = runner
        self._runners.move_to_end(model_version, last=True)
        self._evict_lru_if_needed()

    def _evict_lru_if_needed(self) -> None:
        while len(self._runners) > self.max_cached_runners:
            old_version, old_runner = self._runners.popitem(last=False)
            try:
                old_runner.close()
            except Exception:
                logger.warning("Failed to close evicted runner: %s", old_version, exc_info=True)

    def _record_resolution(
        self,
        *,
        requested_version: str | None,
        resolved_version: str,
        fallback_from: str | None,
        cache_hit: bool,
        load_ms: int,
    ) -> None:
        self.last_resolution = {
            "requested_version": requested_version,
            "resolved_version": resolved_version,
            "fallback_from": fallback_from,
            "cache_hit": cache_hit,
            "load_ms": load_ms,
            "cache_size": len(self._runners),
        }
