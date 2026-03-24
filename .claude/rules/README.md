# Claude Code Rules

Enforced guidelines loaded automatically from `.claude/rules/`. Priority: MANDATORY > Required > Recommended.

## Global Rules (load every prompt)

| Rule          | File                                           | Level         |
| ------------- | ---------------------------------------------- | ------------- |
| Skill Reading | [skill-enforcement.md](./skill-enforcement.md) | **MANDATORY** |
| Code Quality  | [code-quality.md](./code-quality.md)           | Required      |
| Security      | [security.md](./security.md)                   | Required      |
| Testing       | [testing.md](./testing.md)                     | Required      |
| Git Workflow  | [git-workflow.md](./git-workflow.md)           | Required      |

## Path-Scoped Rules (load only when editing matching files)

| Rule              | File                                           | Applies To                                              |
| ----------------- | ---------------------------------------------- | ------------------------------------------------------- |
| TypeScript Syntax | [syntax-typescript.md](./syntax-typescript.md) | `api/**/*.ts`, `apps/**/*.{ts,tsx}`, `packages/**/*.ts` |
| Python Syntax     | [syntax-python.md](./syntax-python.md)         | `services/**/*.py`                                      |
