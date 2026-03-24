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

**This project:** Main branch `main`, feature branches from `main`, CI must pass before merge.

**Enforcement:** Required — follow git workflow for all changes.
