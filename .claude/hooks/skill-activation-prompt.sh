#!/bin/bash
set -e

# --- ROBUSTNESS FIX: Auto-detect CLAUDE_PROJECT_DIR if not set ---
if [ -z "$CLAUDE_PROJECT_DIR" ]; then
    # Get the directory where this script is located (e.g., /.../.claude/hooks)
    # This works regardless of the current working directory (PWD).
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    
    # Go up two levels to find the project root (e.g., /.../price-comparison-app)
    export CLAUDE_PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
    
    # Optional debug message
    # echo "CLAUDE_PROJECT_DIR automatically set to: $CLAUDE_PROJECT_DIR" >&2
fi
# ----------------------------------------------------------------

cd "$CLAUDE_PROJECT_DIR/.claude/hooks"
cat | npx tsx skill-activation-prompt.ts