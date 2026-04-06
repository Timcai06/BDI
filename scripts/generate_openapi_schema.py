#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi import FastAPI


def main() -> int:
    repo_root = Path(__file__).resolve().parents[1]
    backend_root = repo_root / "backend"
    sys.path.insert(0, str(backend_root))

    from app.api.routes import router as core_router
    from app.api.v1_routes import router as v1_router

    app = FastAPI(title="BDI API", version="0.1.0")
    app.include_router(core_router)
    app.include_router(v1_router)

    output_path = repo_root / "artifacts" / "openapi" / "frontend-openapi.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(app.openapi(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
