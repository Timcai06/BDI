from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class RuntimeState:
    active_model_version: str
    active_runner: str
    ready: bool
    details: dict[str, Any] = field(default_factory=dict)
    last_error: str | None = None
