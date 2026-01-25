# Claude Code Rules

Modular rules that MUST be followed. These are enforced guidelines, not suggestions.

## Active Rules

| Rule | File | Enforcement |
|------|------|-------------|
| Skill Reading | [skill-enforcement.md](./skill-enforcement.md) | **MANDATORY** |
| Code Quality | [code-quality.md](./code-quality.md) | Required |
| Security | [security.md](./security.md) | Required |
| Testing | [testing.md](./testing.md) | Required |
| Git Workflow | [git-workflow.md](./git-workflow.md) | Required |

## How Rules Work

1. Rules are referenced in [CLAUDE.md](../../CLAUDE.md)
2. Claude MUST check rules before taking actions
3. Violations should be flagged immediately

## Rule Priority

1. **MANDATORY** - Must be followed without exception
2. **Required** - Follow unless explicitly overridden by user
3. **Recommended** - Best practice, may be skipped with justification

## Adding New Rules

1. Create a new `.md` file in this directory
2. Add to the table in this README
3. Reference in CLAUDE.md if critical
4. Document enforcement level clearly
