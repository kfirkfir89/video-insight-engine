#!/bin/bash
# Accent-Only-In-Outputs guard (DESIGN.md §6).
# Interactive output components must reference var(--vie-accent) and semantic
# tokens only — never the `primary` (identity) or `cta` (action) tokens.
# The CSS fallback form `var(--vie-accent, var(--primary))` is allowed: it
# resolves to the accent whenever a video output sets one.
#
# Usage: scripts/check-accent-only.sh [dir ...]
# Exits 1 and prints offending lines when a forbidden token is found.

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

default_dirs=(
  "apps/web/src/features/video-output/components/output/interactive"
)

dirs=("${@:-${default_dirs[@]}}")

# Tailwind utilities bound to the primary/cta color tokens, plus raw var() refs.
forbidden='((text|bg|border|ring|from|to|via|fill|stroke|shadow|outline|decoration|accent|caret|divide)-\[?(primary|cta)\b|var\(--(primary|cta)\b)'
# Allowed accent-first fallback: var(--vie-accent, var(--primary))
allowed_fallback='var\(--vie-accent,[[:space:]]*var\(--primary\)\)'

fail=0
for dir in "${dirs[@]}"; do
  if [[ "$dir" = /* ]]; then abs="$dir"; else abs="$repo_root/$dir"; fi
  if [[ ! -d "$abs" ]]; then
    echo "check-accent-only: directory not found: $dir" >&2
    exit 2
  fi
  while IFS= read -r file; do
    # Strip the allowed fallback form, then look for any remaining forbidden token.
    hits="$(sed -E "s/${allowed_fallback}//g" "$file" | grep -nE "$forbidden" || true)"
    if [[ -n "$hits" ]]; then
      fail=1
      while IFS= read -r hit; do
        echo "${file#"$repo_root"/}:${hit}"
      done <<<"$hits"
    fi
  done < <(find "$abs" -type f \( -name '*.tsx' -o -name '*.ts' \) \
    ! -path '*/__tests__/*' ! -name '*.test.ts' ! -name '*.test.tsx')
done

if [[ "$fail" -eq 1 ]]; then
  echo "" >&2
  echo "Accent-Only-In-Outputs violation (DESIGN.md §6): output components must use" >&2
  echo "var(--vie-accent) / semantic tokens, never primary or cta tokens." >&2
  echo "Allowed fallback form: var(--vie-accent, var(--primary))" >&2
  exit 1
fi

echo "check-accent-only: clean (${dirs[*]})"
