from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class RuntimeState:
    active_model_version: str
    active_runner: str
    ready: bool
    details: dict[str, Any] = field(default_factory=dict)
    last_error: str | None = None
    active_backend: str | None = None
    fallback_from: str | None = None
    last_transition_at: str | None = None
    last_load_ms: int | None = None
    cache_hit: bool | None = None


def refresh_runtime_state(*, runtime_state: RuntimeState, spec: Any, runner: Any, resolution: dict[str, Any]) -> RuntimeState:
    details = runner.health_check() if hasattr(runner, "health_check") else {}
    changed = runtime_state.active_model_version != spec.model_version

    runtime_state.active_model_version = spec.model_version
    runtime_state.active_runner = f"{runner.name}:{spec.model_version}"
    runtime_state.active_backend = spec.backend
    runtime_state.ready = runner.ready
    runtime_state.details = details
    runtime_state.fallback_from = resolution.get("fallback_from")
    runtime_state.last_load_ms = resolution.get("load_ms")
    runtime_state.cache_hit = resolution.get("cache_hit")
    if changed:
        runtime_state.last_transition_at = datetime.now(timezone.utc).isoformat()
    runtime_state.last_error = None
    return runtime_state
