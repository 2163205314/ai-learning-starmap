#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "AI 学习星图 macOS/Linux 启动脚本"

find_python() {
  for candidate in python3.12 python3 python; do
    if command -v "$candidate" >/dev/null 2>&1; then
      if "$candidate" -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 12) else 1)"; then
        echo "$candidate"
        return 0
      fi
    fi
  done
  return 1
}

PYTHON_CMD="$(find_python || true)"
if [ -z "$PYTHON_CMD" ]; then
  echo "未找到 Python 3.12 或更高版本。"
  echo "macOS 可用 Homebrew 安装: brew install python@3.12"
  echo "Ubuntu/Debian 可尝试: sudo apt install python3.12 python3.12-venv"
  exit 1
fi

"$PYTHON_CMD" scripts/bootstrap.py "$@"
