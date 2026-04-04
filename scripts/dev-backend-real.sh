#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/backend"

source .venv-yolo/bin/activate
export BDI_TASK_WORKER_ENABLED=true
exec python3 -m uvicorn app.main:app --reload
