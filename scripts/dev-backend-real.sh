#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/backend"

source .venv-yolo/bin/activate
exec python3 -m uvicorn app.main:app --reload
