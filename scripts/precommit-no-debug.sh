#!/bin/bash
# Pre-commit guard: block console.log in staged api/src TypeScript files.
# Invoked by lint-staged (cwd: api/) with staged file paths as arguments.
# Test and test-helper files are exempt.

set -euo pipefail

fail=0
for file in "$@"; do
  case "$file" in
    *.test.ts | *.spec.ts | */src/test/* | */scripts/*) continue ;;
  esac
  if grep -nH 'console\.log(' "$file"; then
    fail=1
  fi
done

if [[ "$fail" -eq 1 ]]; then
  echo "" >&2
  echo "console.log is not allowed in api/src — use the fastify/pino logger." >&2
  echo "(Tests and src/test helpers are exempt.)" >&2
  exit 1
fi
