#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Project: $ROOT_DIR"
echo

if [ -d "$ROOT_DIR/frontend/node_modules" ]; then
  echo "[ok] frontend dependencies detected"
else
  echo "[warn] frontend/node_modules missing"
fi

if [ -x "$ROOT_DIR/backend/.venv/bin/python" ]; then
  echo "[ok] backend mock env ready: backend/.venv"
else
  echo "[warn] backend/.venv missing"
fi

if [ -x "$ROOT_DIR/backend/.venv-yolo/bin/python" ]; then
  echo "[ok] backend real env ready: backend/.venv-yolo"
else
  echo "[warn] backend/.venv-yolo missing"
fi

if [ -f "$ROOT_DIR/backend/.env" ]; then
  echo "[ok] backend/.env present"
else
  echo "[warn] backend/.env missing"
fi
