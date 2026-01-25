# Git Workflow Rules

## Commits

- Use conventional commits format
- Keep commits atomic and focused
- Write meaningful commit messages
- Reference issues when applicable

### Conventional Commits Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Commit Types

| Type | Use For |
|------|---------|
| feat | New features |
| fix | Bug fixes |
| docs | Documentation only |
| style | Formatting, no code change |
| refactor | Code change, no behavior change |
| test | Adding/fixing tests |
| chore | Maintenance tasks |

### Examples

```
feat(api): add cache invalidation endpoint
fix(auth): handle expired token refresh
docs(readme): update installation steps
refactor(web): extract form validation hook
```

## Branches

- Create feature branches for new work
- Never commit directly to main
- Keep branches up to date with main
- Delete branches after merge

### Branch Naming

```
feature/add-caching-layer
fix/auth-token-refresh
refactor/extract-validation
```

## Pull Requests

- All changes via PR
- Include description of changes
- Link related issues
- All tests must pass
- Request review when ready

## Before Commit

- Run tests: `npm test`
- Check types: `npm run typecheck` (if applicable)
- Run linter: `npm run lint`
- Don't commit:
  - Debug code
  - Console logs
  - Commented code
  - Secrets/credentials

## This Project

- Main branch: `main`
- Feature branches from: `main`
- PR reviews: Required for main
- CI: Must pass before merge

## Enforcement Level

**Required** - Follow git workflow for all changes.
