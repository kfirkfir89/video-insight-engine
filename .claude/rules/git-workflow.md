# Git Workflow Rules

<rules>
- ALWAYS use conventional commits: `type(scope): description` — types: feat, fix, docs, style, refactor, test, chore
- NEVER commit directly to main — always use feature branches and PRs (protects shared branch from broken code)
- ALWAYS run tests, typecheck, and linter before committing (catches errors before they enter history)
- NEVER commit debug code, console logs, commented code, or secrets/credentials (pollutes history and risks exposure)
- ALWAYS keep commits atomic and focused — one logical change per commit (makes bisect and revert possible)
</rules>

**Branches:** `feature/add-caching-layer`, `fix/auth-token-refresh`, `refactor/extract-validation`. Delete after merge.

**PRs:** Include description, link issues, all tests must pass, request review when ready.

**This project:** Main branch `main` (protected, tagged releases), feature branches from `main`, CI must pass before merge.

**Commit cadence — commit-per-green-phase:** Task work is planned in phases (`dev/active/*/tasks.md`). Commit at every green phase boundary: when a phase's tasks are done and suites pass, that phase lands as one (or a few atomic) commits immediately — never let multiple phases of work accumulate uncommitted. Refactors/splits are one move per commit (bisectable). Milestones (task completion, audits) get a version tag. No working tree should hold >1 phase of unpushed work overnight.

**Working-tree safety:** All mutations (commit, push, stash, reset, checkout --, restore, clean) require explicit current-turn user approval (see CLAUDE.md). Enforced by `.claude/hooks/git-safety-guard.sh`, which blocks destructive commands unless a single-use override file is present.

**Enforcement:** Required — follow git workflow for all changes.
