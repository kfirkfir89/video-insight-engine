# Development Tasks & Documentation

Task planning that survives context resets. **Current state lives in `dev/active/` — this file only explains the system.** Do not list tasks here; they go stale (this file once described a task 4 months dead).

## Directory Structure

```
dev/
├── README.md            # This file (evergreen — no task-specific content)
├── gotchas.md           # Bug knowledge base: check BEFORE debugging
├── scratchpad.md        # Quick notes, current context
├── CODE-REVIEW-FIXES.md # Review-finding dispositions
├── golden-dataset/      # Eval dataset (videos.yaml) for scripts/run_eval.py
├── diagnostics/         # Ad-hoc investigation artifacts
├── research/            # Longer-lived research notes
├── active/              # ← ACTIVE tasks (source of truth)
│   └── [task-name]/
│       ├── [task-name]-plan.md              # Implementation plan
│       ├── [task-name]-context.md           # Key files, decisions, constraints
│       ├── [task-name]-tasks.md             # Progress checklist (kept current)
│       └── [task-name]-session-snapshot.json # Auto-saved by Stop hook
└── completed/           # Finished/archived tasks (kept for history)
```

## Workflow

| Command | Purpose |
|---------|---------|
| `/task-plan {name}` | Create a new task (plan + context + tasks files) |
| `/resume {task}` | Resume after chat clear — reads context → tasks → plan |
| `/task-plan-update` | Update task docs before context compaction |
| `/complete-task {task}` | Full completion workflow (test → security → review → docs) |

Conventions:
- **tasks.md is the live record** — check items off as they land, note blockers inline, keep a Progress Log section at the bottom.
- Completed tasks move to `dev/completed/` (append an ARCHIVED note to the context file with date + reason).
- Session snapshots are written automatically by `.claude/hooks/auto-save-context.sh`, scoped to tasks whose files the session edited.
- Commit cadence: one green phase = one commit (see `.claude/rules/git-workflow.md`).
