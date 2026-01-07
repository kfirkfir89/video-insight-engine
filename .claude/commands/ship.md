# /ship Command

Pre-deployment checklist and verification.

## Usage

```
/ship                      # Full pre-deploy check
/ship --quick              # Quick checks only
```

## What It Does

1. **Run all quality checks**
2. **Verify tests pass**
3. **Check for common issues**
4. **Generate ship report**

## Checklist

### Code Quality
- [ ] TypeScript compiles (`npm run typecheck`)
- [ ] ESLint passes (`npm run lint`)
- [ ] Prettier formatted (`npm run format:check`)
- [ ] No console.log statements
- [ ] No TODO without tracking

### Tests
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Coverage acceptable (>80%)

### Security
- [ ] No secrets in code
- [ ] No hardcoded credentials
- [ ] Dependencies up to date
- [ ] No known vulnerabilities (`npm audit`)
- [ ] Rate limiting configured (per [docs/SECURITY.md](../../docs/SECURITY.md))
- [ ] JWT refresh flow correct (per [docs/SECURITY.md](../../docs/SECURITY.md))
- [ ] CORS configured for specific origins
- [ ] Video validation implemented (per [docs/ERROR-HANDLING.md](../../docs/ERROR-HANDLING.md))
- [ ] Error codes consistent (per [docs/ERROR-HANDLING.md](../../docs/ERROR-HANDLING.md))

### Documentation
- [ ] README updated (if needed)
- [ ] API docs updated (if new endpoints)
- [ ] CHANGELOG updated

### Git
- [ ] Branch is up to date with main
- [ ] Commit messages follow convention
- [ ] No merge conflicts

### Docker
- [ ] Docker build succeeds
- [ ] Docker compose up works
- [ ] Health checks pass

## Output

```markdown
## 🚀 Ship Report

**Status:** Ready to ship ✅

### Quality Checks
✅ TypeScript: No errors
✅ ESLint: 0 errors, 0 warnings
✅ Prettier: All files formatted

### Tests
✅ Unit tests: 45/45 passed
✅ Integration: 12/12 passed
✅ Coverage: 87%

### Security
✅ No secrets detected
✅ npm audit: 0 vulnerabilities

### Docker
✅ Build: Success
✅ Health checks: All passing

### Recommendations
- Consider adding more edge case tests for video service
- Update API documentation for new endpoint

**Ready to merge and deploy!**
```

## If Issues Found

```markdown
## 🚀 Ship Report

**Status:** Not ready ❌

### Blockers
❌ TypeScript: 2 errors
❌ Tests: 3 failing

### Required Actions
1. Fix TypeScript errors in api/src/routes/videos.ts
2. Fix failing test in video.service.test.ts

Run `/review` for detailed analysis.
```
