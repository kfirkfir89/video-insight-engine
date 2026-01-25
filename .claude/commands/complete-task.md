---
description: Run full task completion workflow (plan → test → security → review → update-docs)
argument-hint: Task name to complete (e.g., "add-caching")
---

Execute the complete task workflow for: $ARGUMENTS

## Workflow Steps

Run these steps in order:

### Step 1: Verify Task Plan
- Check `dev/active/$ARGUMENTS/` exists
- Read the plan and context files
- Confirm implementation matches the plan
- List all files that were modified for this task

### Step 2: Generate/Run Tests
- Identify files modified for this task
- Generate tests for new code (apply /test patterns)
- Run existing tests to verify nothing broke
- Report coverage for modified files

### Step 3: Security Check
- Run security audit on modified files (apply /security-check patterns)
- Check for:
  - Hardcoded secrets
  - Input validation
  - Auth/authz issues
  - Rate limiting on new endpoints
  - Error exposure

### Step 4: Code Review
- Review all changes for this task (apply /review patterns)
- Check:
  - Type safety
  - Error handling
  - Code patterns match project conventions
  - No debug code left behind
  - Proper logging

### Step 5: Update Documentation
- Update project documentation (apply /update-docs patterns)
- Check and update:
  - `docs/` folder (API, architecture, services, etc.)
  - `CLAUDE.md` (if tech stack, commands, or design decisions changed)
  - `README.md` (if features, setup, or architecture changed)

## Output Format

```
## ✅ Task Completion Report: [task-name]

### 1. Plan Verification
✅ Implementation matches plan
- [X] Phase 1 complete
- [X] Phase 2 complete

### 2. Tests
✅ Tests passing
- Generated: 3 new test files
- Coverage: 85%
- All tests pass

### 3. Security
✅ No issues found
- No secrets detected
- Input validation: OK
- Auth checks: OK

### 4. Code Review
✅ Code quality good
- Type safety: OK
- Error handling: OK
- Patterns: Consistent

### 5. Documentation
✅ Docs updated
- Updated: docs/API-REFERENCE.md
- Updated: CLAUDE.md (tech stack)
- No changes needed: README.md

---
**Task complete! Run /ship when ready to deploy.**
```

## On Failure

If any step fails, stop and report:
- Which step failed
- What the issues are
- How to fix them

Do NOT proceed to next steps until issues are resolved.

```
## ⚠️ Task Completion Report: [task-name]

### 1. Plan Verification
✅ Implementation matches plan

### 2. Tests
❌ FAILED - Issues found
- test/api/cache.test.ts: 2 failing tests
  - Expected cache hit, got miss
  - Timeout on invalidation test

**Fix these issues before proceeding.**

Remaining steps not executed:
- [ ] Security Check
- [ ] Code Review
- [ ] Documentation Update
```

## If Task Not Found

```
## ❌ Task Not Found

Task `$ARGUMENTS` not found in `dev/active/`.

**Available tasks:**
- [list available tasks]

**Or use /list-tasks to see all active tasks**
```

## After Successful Completion

Consider:
- Moving task docs to `dev/completed/` or archiving
- Running `/ship` if ready to deploy
- Updating the task status in `-tasks.md` to 100% complete
