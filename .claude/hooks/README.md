# Hooks — Video Insight Engine

Claude Code hooks for this repo: skill auto-activation, guarded edits, git
working-tree safety, session tracking, and Stop-time verification. All hooks
are **fail-open**: any parse/read error results in "allow", never a block.

Wiring lives in `.claude/settings.json`. State lives per-session under
`.claude/tsc-cache/<session_id>/` (GC'd after 7 days by the Stop hook).

## Inventory

| Hook | Event (matcher) | What it does |
| --- | --- | --- |
| `skill-activation-prompt.sh` → `.ts` | UserPromptSubmit | Word-boundary matches the prompt against `skills/skill-rules.json`; caps at `globalSettings.maxSkillsPerPrompt`; writes `skill-state.json` for block-enforced skills; silent when nothing matches. Also prints context-size warning + active-tasks reminder. |
| `git-safety-guard.sh` | PreToolUse (Bash) | Denies destructive git (stash/reset --hard/checkout --/clean/force-push/branch -D); asks on commit/push. Enforces the CLAUDE.md working-tree rule mechanically. |
| `pre-edit-guard.ts` | PreToolUse (Edit\|Write\|MultiEdit) | Single merged guard: (1) **skill block** — blocks edits only when an unconsumed block-skill's `fileTriggers.pathPatterns` match the target file; `.claude/`, `dev/`, `docs/`, and `*.md` are never blocked; (2) **TDD reminder** — warn-only nudge when a source file is edited with no related test modified this session (per-session state). |
| `post-tool-use-tracker.sh` | PostToolUse (Edit\|MultiEdit\|Write) | Logs edited files + affected repos to the session cache (consumed by Stop hooks and snapshots). |
| `auto-format.sh` | PostToolUse (Edit\|MultiEdit\|Write) | ESLint --fix for `apps/web` TS(X); ruff format/check for Python. Best-effort. |
| `continuous-learning.ts` | PostToolUse (Edit\|MultiEdit\|Write) | Accumulates session insights (new files, high-iteration files, cross-service edits) into `insights.json`; surfaced by `tsc-check-stop.sh` at Stop. |
| `skill-read-tracker.ts` | PostToolUse (Read) | Marks a skill consumed when its SKILL.md/resources are read → unblocks `pre-edit-guard`. |
| `tsc-check-stop.sh` | Stop | Runs `tsc --noEmit` on affected TS repos (first 5 error lines shown); prints insight summary; GCs session cache dirs older than 7 days. |
| `auto-save-context.sh` | Stop | Writes a session snapshot ONLY to tasks whose `dev/active/<task>/` files were edited this session; otherwise falls back to `dev/active/.last-session-snapshot.json`. |

## Testing

```bash
cd .claude/hooks && npm test        # vitest: skill enforcement + activation regression set,
                                    # git-safety-guard (31 cases), continuous-learning
```

Run this after ANY change to a hook or to `skill-rules.json`. The activation
regression set pins 10 historic false-positive prompts (e.g. "build a feature",
"the rapid fix", bare "retry") to zero activations — if you add keywords, keep
it green.

## Manual smoke test

```bash
echo '{"session_id":"smoke","tool_name":"Edit","tool_input":{"file_path":"api/src/x.ts"}}' \
  | npx tsx pre-edit-guard.ts        # from .claude/hooks/
```

## Design rules for new hooks

1. Fail-open — wrap everything; on error emit `{"decision":"allow"}` (guards) or exit 0.
2. Per-session state only — write under `.claude/tsc-cache/<session_id>/`, never a global file (concurrent sessions clobber globals).
3. One process per event where possible — each `npx tsx` spawn costs ~0.5s; extend `pre-edit-guard.ts` rather than adding another PreToolUse command.
4. Add tests in `__tests__/` in the same PR.
