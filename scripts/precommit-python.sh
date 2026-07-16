#!/bin/bash
# Pre-commit for staged Python files (invoked by lint-staged, cwd: repo root).
# 1. Block print( in service/package src trees (tests + scripts are exempt).
# 2. ruff format + ruff check --fix using the root ruff.toml.
# Mirrors .claude/hooks/auto-format.sh ruff resolution.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Resolve a ruff binary: PATH first, then the summarizer venv.
if command -v ruff &>/dev/null; then
  RUFF="ruff"
elif [[ -x "$ROOT/services/summarizer/.venv/bin/ruff" ]]; then
  RUFF="$ROOT/services/summarizer/.venv/bin/ruff"
else
  echo "precommit-python: ruff not found (PATH or services/summarizer/.venv) — skipping lint" >&2
  RUFF=""
fi

fail=0
for file in "$@"; do
  # print( guard applies only to src trees, not tests/scripts.
  case "$file" in
    */tests/* | */scripts/* | *test_*.py | *conftest.py) ;;
    */src/*.py)
      if grep -nH '^\s*print(' "$file"; then
        fail=1
      fi
      ;;
  esac
done

if [[ "$fail" -eq 1 ]]; then
  echo "" >&2
  echo "print( is not allowed in service src — use structlog. (Tests/scripts are exempt.)" >&2
  exit 1
fi

if [[ -n "$RUFF" ]]; then
  "$RUFF" format "$@"
  "$RUFF" check --fix --config "$ROOT/ruff.toml" "$@"
fi
