from __future__ import annotations

from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import status

from app.core.errors import AppError

BACKEND_ROOT = Path(__file__).resolve().parents[2]
WORKSPACE_ROOT = BACKEND_ROOT.parent


def new_id(prefix: str, length: int = 16) -> str:
    return f"{prefix}_{uuid4().hex[:length]}"


def raise_not_found(entity_name: str, entity_id: str, *, code: Optional[str] = None, id_key: Optional[str] = None) -> None:
    raise AppError(
        code=code or f"{entity_name}_NOT_FOUND",
        message=f"{entity_name.replace('_', ' ').title()} does not exist.",
        status_code=status.HTTP_404_NOT_FOUND,
        details={id_key or entity_name.lower(): entity_id},
    )


def resolve_path(raw_path: str, *, fallback: bool = True) -> Optional[Path]:
    candidate = Path(raw_path)
    if candidate.is_absolute():
        if candidate.exists():
            return candidate
        return candidate if fallback else None
    options = [
        Path.cwd() / candidate,
        BACKEND_ROOT / candidate,
        WORKSPACE_ROOT / candidate,
    ]
    for path in options:
        if path.exists():
            return path
    return options[0] if fallback else None