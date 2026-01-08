# /review Command

Trigger a comprehensive code review of recent changes.

## Usage

```
/review                    # Review all uncommitted changes
/review api                # Review changes in api/ only
/review video.service.ts   # Review specific file
```

## What It Does

1. **Identify changes** - git diff or specific files
2. **Load relevant skills** - Based on file types
3. **Apply code-reviewer agent**
4. **Generate report**

## Review Checklist

### All Code

- [ ] No console.log/print statements (except logging)
- [ ] No commented-out code
- [ ] No TODO without issue reference
- [ ] Proper error handling
- [ ] Type safety (no `any`)

### TypeScript (api, web)

- [ ] Zod schemas for validation
- [ ] Proper async/await
- [ ] No memory leaks (cleanup)
- [ ] React hooks rules followed

### Python (summarizer, explainer)

- [ ] Type hints on all functions
- [ ] Pydantic for data models
- [ ] Proper exception handling
- [ ] No bare except clauses

### Tests

- [ ] Tests for new functionality
- [ ] Edge cases covered
- [ ] Mocks used appropriately
- [ ] Assertions are meaningful

## Output Format

````markdown
## Code Review Summary

**Files reviewed:** 5
**Issues found:** 2 critical, 3 warnings

### ❌ Critical Issues

1. **Missing error handling** in `api/src/routes/videos.ts:45`

   ```typescript
   // Current
   const result = await service.create(data);

   // Should be
   try {
     const result = await service.create(data);
   } catch (error) {
     throw fastify.httpErrors.badRequest(error.message);
   }
   ```
````

### ⚠️ Warnings

1. Consider extracting magic number to constant

### ✅ Good Practices Observed

- Proper TypeScript types
- Consistent naming

```

```
