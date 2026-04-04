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

open_backend_window() {
  local backend_dir_escaped backend_env_escaped backend_python_escaped
  backend_dir_escaped="${ROOT_DIR//\"/\\\"}/backend"
  backend_env_escaped="${BACKEND_ENV//\"/\\\"}"
  backend_python_escaped="${BACKEND_PYTHON//\"/\\\"}"
  osascript >/dev/null 2>&1 <<EOF || true
tell application "Terminal"
  activate
  do script "printf '\\\033]0;BDI Backend ($MODE)\\\007'; clear; echo 'BDI Backend ($MODE mode)'; echo 'Project: $backend_dir_escaped'; echo 'Press Ctrl+C in this window to stop the backend.'; echo; cd \"$backend_dir_escaped\"; source \"$backend_env_escaped/bin/activate\"; export BDI_TASK_WORKER_ENABLED=true; $backend_python_escaped -m uvicorn app.main:app --reload"
end tell
EOF
}

open_backend_window

echo "Backend will start in a new Terminal window ($MODE mode)."
echo "Frontend starting..."
echo

cd "$ROOT_DIR/frontend"
exec npm run dev
