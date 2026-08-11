#!/bin/bash
# Auto-format hook: runs linter/formatter after file edits
# Runs on PostToolUse for Edit|Write|MultiEdit
# Best-effort — never blocks Claude (always exits 0)

tool_info=$(cat)
file_path=$(echo "$tool_info" | jq -r '.tool_input.file_path // empty')

# Skip if no file path
[[ -z "$file_path" ]] && exit 0

# Skip non-source files
[[ "$file_path" =~ \.(md|json|yaml|yml|txt|sh|css|html|svg)$ ]] && exit 0
[[ "$file_path" =~ node_modules|\.next|dist|\.venv|__pycache__ ]] && exit 0

PROJECT_DIR="$CLAUDE_PROJECT_DIR"

# TypeScript/JavaScript — run ESLint --fix where config exists
if [[ "$file_path" =~ \.(ts|tsx|js|jsx)$ ]]; then
  # apps/web has eslint.config.js
  if [[ "$file_path" == *"apps/web/"* ]] && [[ -f "$PROJECT_DIR/apps/web/eslint.config.js" ]]; then
    cd "$PROJECT_DIR/apps/web" && npx eslint --fix "$file_path" 2>/dev/null
  fi
fi

# Python — run ruff if available
if [[ "$file_path" =~ \.py$ ]]; then
  if command -v ruff &>/dev/null; then
    ruff format "$file_path" 2>/dev/null
    ruff check --fix "$file_path" 2>/dev/null
  elif [[ -f "$PROJECT_DIR/services/summarizer/.venv/bin/ruff" ]]; then
    "$PROJECT_DIR/services/summarizer/.venv/bin/ruff" format "$file_path" 2>/dev/null
    "$PROJECT_DIR/services/summarizer/.venv/bin/ruff" check --fix "$file_path" 2>/dev/null
  fi
fi

exit 0
