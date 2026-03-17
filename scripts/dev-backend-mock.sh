#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/backend"

source .venv/bin/activate
exec python -m uvicorn app.main:app --reload
