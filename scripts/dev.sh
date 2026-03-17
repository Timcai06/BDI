#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-real}"

case "$MODE" in
  real)
    BACKEND_ENV=".venv-yolo"
    BACKEND_PYTHON="python3"
    ;;
  mock)
    BACKEND_ENV=".venv"
    BACKEND_PYTHON="python"
    ;;
  *)
    echo "Usage: ./scripts/dev.sh [real|mock]"
    exit 1
    ;;
esac

cd "$ROOT_DIR/backend"

if [ ! -x "$BACKEND_ENV/bin/$BACKEND_PYTHON" ]; then
  echo "Backend environment is not ready: backend/$BACKEND_ENV"
  exit 1
fi

source "$BACKEND_ENV/bin/activate"
"$BACKEND_PYTHON" -m uvicorn app.main:app --reload > /tmp/bdi-backend.log 2>&1 &
BACKEND_PID=$!

cleanup() {
  if kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

echo "Backend started in $MODE mode (pid: $BACKEND_PID)"
echo "Backend log: /tmp/bdi-backend.log"
echo "Frontend starting..."
echo

cd "$ROOT_DIR/frontend"
exec npm run dev
