from __future__ import annotations

import logging
import time
from collections import OrderedDict
from typing import Any, Optional

from app.adapters.base import ModelRunner
from app.adapters.factory import load_runner_for_spec
from app.adapters.registry import ModelRegistry, ModelSpec

logger = logging.getLogger(__name__)


class RunnerManager:
    def __init__(
        self,
        *,
        registry: ModelRegistry,
        allow_fallback: bool,
        max_cached_runners: int = 2,
    ) -> None:
        self.registry = registry
        self.allow_fallback = allow_fallback
        self.max_cached_runners = max(1, max_cached_runners)
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

        if spec.model_version in self._runners:
            runner = self._runners[spec.model_version]
            # Touch on read to keep LRU order fresh.
            self._runners.move_to_end(spec.model_version, last=True)
            self._record_resolution(
                requested_version=requested_version,
                resolved_version=spec.model_version,
                fallback_from=fallback_from,
                cache_hit=True,
                load_ms=int((time.perf_counter() - start) * 1000),
            )
            return spec, runner

        try:
            runner = load_runner_for_spec(spec)
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
            if spec.model_version in self._runners:
                runner = self._runners[spec.model_version]
                self._runners.move_to_end(spec.model_version, last=True)
                self._record_resolution(
                    requested_version=requested_version,
                    resolved_version=spec.model_version,
                    fallback_from=fallback_from,
                    cache_hit=True,
                    load_ms=int((time.perf_counter() - start) * 1000),
                )
                return spec, runner

            runner = load_runner_for_spec(spec)

        try:
            runner.warmup()
        except Exception:
            pass

        self._runners[spec.model_version] = runner
        self._runners.move_to_end(spec.model_version, last=True)
        self._evict_lru_if_needed()
        self._record_resolution(
            requested_version=requested_version,
            resolved_version=spec.model_version,
            fallback_from=fallback_from,
            cache_hit=False,
            load_ms=int((time.perf_counter() - start) * 1000),
        )
        return spec, runner

    def _resolve_spec(self, model_version: Optional[str]) -> ModelSpec:
        if model_version is None:
            return self.registry.resolve_active(allow_fallback=self.allow_fallback)

        return self.registry.get(model_version)

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
