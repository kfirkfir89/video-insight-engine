---
description: Resume an active task from dev/active/
argument-hint: Task name to resume (e.g., "add-caching") or leave empty to list tasks
---

Resume work on an existing task from `dev/active/`.

## Instructions

### If $ARGUMENTS provided (task name):

1. **Verify task exists**: Check `dev/active/$ARGUMENTS/` directory
2. **Read context**: Load `dev/active/$ARGUMENTS/$ARGUMENTS-context.md`
3. **Read tasks**: Load `dev/active/$ARGUMENTS/$ARGUMENTS-tasks.md`
4. **Read plan**: Load `dev/active/$ARGUMENTS/$ARGUMENTS-plan.md`
5. **Show status summary**:
   - Last updated date
   - Completed tasks (✅)
   - In-progress tasks
   - Next immediate steps
   - Any blockers noted
6. **Ask**: "Ready to continue? What would you like to work on first?"

### If no arguments:

1. **List active tasks**: Show all directories in `dev/active/`
2. **For each task**: Show name and last updated date from context file
3. **Ask**: "Which task would you like to resume?"

## Output Format

```
## 📋 Resuming: [task-name]

**Last Updated:** YYYY-MM-DD

### Progress
- ✅ Completed: X tasks
- 🔄 In Progress: Y tasks
- ⏳ Remaining: Z tasks

### Current State
[Summary from context.md]

### Next Steps
1. [First pending task]
2. [Second pending task]

### Blockers (if any)
- [Any noted blockers]

Ready to continue. What would you like to tackle first?
```

## If Task Not Found

```
## ❌ Task Not Found

Task `$ARGUMENTS` not found in `dev/active/`.

**Available tasks:**
- [list of actual tasks]

**Or create a new task:**
- `/task-plan $ARGUMENTS` - Create task documentation
```

## Context Loading Priority

When resuming, load files in this order:
1. `-context.md` - Most current state
2. `-tasks.md` - Progress tracking
3. `-plan.md` - Original plan (for reference)

Focus on what changed recently and what needs to be done next.
