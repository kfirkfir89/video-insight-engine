#!/bin/bash
# Git safety guard: blocks working-tree-destructive git commands.
# Runs on PreToolUse for Bash. Exit 2 = block (stderr shown to Claude).
#
# Blocked: git stash (except list/show), git reset --hard, git checkout --,
#          git checkout . , git clean, git restore (except pure --staged),
#          git push --force/-f, branch -D on main.
# Override: create .claude/hooks/.git-safety-override (single-use — consumed on
#           first allowed dangerous command) after explicit user approval.
#
# Rationale: CLAUDE.md working-tree safety. 2026-05-28 stash incident nearly
# lost a day's work; prose bans don't stop tools, hooks do.

tool_info=$(cat)
cmd=$(echo "$tool_info" | jq -r '.tool_input.command // empty')

[[ -z "$cmd" ]] && exit 0

# Collapse whitespace/newlines so multi-line and padded commands still match.
# Then: (1) UNWRAP single-word quoted tokens — git "stash" / git stas"h" must
# not evade detection; (2) strip remaining (multi-word) quoted strings so
# mentions like echo "git stash is banned" or commit messages don't
# false-positive.
flat=$(echo "$cmd" | tr '\n\t' '  ' | sed 's/  */ /g' \
  | sed "s/'\([^' ]*\)'/\1/g; s/\"\([^\" ]*\)\"/\1/g" \
  | sed "s/'[^']*'//g; s/\"[^\"]*\"//g")

is_dangerous() {
  local c="$1"
  # git stash — allow read-only subcommands list/show only
  if echo "$c" | grep -qE '\bgit( -[A-Za-z-]+( [^ ]+)?)* stash\b' &&
     ! echo "$c" | grep -qE '\bgit( -[A-Za-z-]+( [^ ]+)?)* stash (list|show)\b'; then
    echo "git stash (banned — 2026-05-28 near-loss; use 'git show HEAD:<path>' or a worktree)"
    return 0
  fi
  if echo "$c" | grep -qE '\bgit( [^ ]+)* reset( [^ ]+)* --hard\b'; then
    echo "git reset --hard (discards uncommitted work)"
    return 0
  fi
  if echo "$c" | grep -qE '\bgit( [^ ]+)* checkout( [^ ]+)* -- ' ||
     echo "$c" | grep -qE '\bgit checkout \.( |$)'; then
    echo "git checkout -- <path> (discards uncommitted work; use 'git show HEAD:<path>' to read)"
    return 0
  fi
  if echo "$c" | grep -qE '\bgit( [^ ]+)* clean\b'; then
    echo "git clean (deletes untracked files)"
    return 0
  fi
  # git restore discards working-tree changes; only a pure --staged unstage
  # (no --worktree/-W, no --source/-s) leaves the working tree untouched.
  if echo "$c" | grep -qE '\bgit( [^ ]+)* restore\b'; then
    if ! echo "$c" | grep -qE '\bgit( [^ ]+)* restore\b[^;|&]*--staged' ||
       echo "$c" | grep -qE '\bgit( [^ ]+)* restore\b[^;|&]*(--worktree\b|-W\b|--source\b|-s )'; then
      echo "git restore (discards uncommitted work; only a pure --staged unstage is allowed)"
      return 0
    fi
  fi
  if echo "$c" | grep -qE '\bgit( [^ ]+)* push\b.* (--force|--force-with-lease|-f)\b' ||
     echo "$c" | grep -qE '\bgit( [^ ]+)* push +(-f|--force|--force-with-lease)\b'; then
    echo "force push (rewrites remote history)"
    return 0
  fi
  if echo "$c" | grep -qE '\bgit branch -D +(main|master)\b'; then
    echo "deleting the main branch"
    return 0
  fi
  return 1
}

reason=$(is_dangerous "$flat") || exit 0

OVERRIDE_FILE="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/hooks/.git-safety-override"
if [[ -f "$OVERRIDE_FILE" ]]; then
  rm -f "$OVERRIDE_FILE"
  echo "git-safety-guard: override consumed — allowing: $flat" >&2
  exit 0
fi

cat >&2 <<EOF
BLOCKED by git-safety-guard: $reason

Command: $flat

This command mutates the working tree and requires explicit, current-turn user
approval per CLAUDE.md. If the user has approved it, create the override file
(touch .claude/hooks/.git-safety-override) and retry — it is consumed after one use.
EOF
exit 2
