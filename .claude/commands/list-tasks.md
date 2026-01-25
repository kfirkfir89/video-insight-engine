---
description: List all active tasks from dev/active/
argument-hint: (no arguments needed)
---

List all active tasks and their current status.

## Instructions

1. **Scan `dev/active/`** for all task directories
2. **For each task**, read the `-tasks.md` file and count:
   - ✅ Completed tasks
   - 🔄 In-progress tasks
   - ⏳ Pending tasks
3. **Read context file** for last updated date
4. **Display summary table**

## Output Format

```
## 📋 Active Tasks

| Task | Progress | Last Updated |
|------|----------|--------------|
| add-caching | 3/5 (60%) | 2025-01-20 |
| auth-refactor | 1/8 (12%) | 2025-01-18 |
| api-optimization | 7/7 (100%) ✅ | 2025-01-15 |

**Commands:**
- `/resume [task-name]` - Continue a task
- `/complete-task [task-name]` - Run completion workflow
- `/task-plan [name]` - Create new task
```

## If No Active Tasks

If `dev/active/` is empty or doesn't exist:

```
## 📋 Active Tasks

No active tasks found.

**To create a new task:**
- `/task-plan [task-name]` - Create task documentation

**Task docs will be stored in:**
- `dev/active/[task-name]/[task-name]-plan.md` - The plan
- `dev/active/[task-name]/[task-name]-context.md` - Context & decisions
- `dev/active/[task-name]/[task-name]-tasks.md` - Progress checklist
```

## Task Status Calculation

When reading `-tasks.md` files:
- Count lines with `- [x]` or `✅` as completed
- Count lines with `- [ ]` or `⏳` as pending
- Count lines with `🔄` or "in progress" as in-progress
- Calculate percentage: `completed / total * 100`

## Date Extraction

Extract "Last Updated" from the context file header or use file modification date as fallback.
