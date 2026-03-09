# API Best Practices Refactor Plan

**Last Updated:** 2026-02-01
**Status:** Ready for Implementation
**Effort:** XL (4 phases, ~5-7 developer-days)
**Current Score:** 6.5/10 → **Target Score:** 9/10

---

## Executive Summary

Comprehensive refactor of the `api/` backend to address critical gaps identified in the best practices audit. The codebase has strong foundations (route organization, validation, auth) but lacks testability infrastructure (no DI, no repository layer, no tests) and has security gaps (helmet not registered, no process handlers).

**Goal:** Transform the API into a production-ready, testable, and maintainable codebase following SOLID principles.

---

## Current State Analysis

### Strengths (Keep These)
| Area | Score | Notes |
|------|-------|-------|
| Route Organization | 9/10 | Feature-grouped, validated, delegates to services |
| Plugin Architecture | 9/10 | Clean encapsulation, proper lifecycle |
| Error Classes | 8/10 | 18 domain-specific errors with proper hierarchy |
| Input Validation | 9/10 | Comprehensive Zod schemas on all routes |
| JWT & Auth | 9/10 | Bcrypt, secure cookies, rotation |
| Rate Limiting | 8/10 | Per-endpoint customization |

### Critical Gaps (Must Fix)
| Issue | Impact | Fix |
|-------|--------|-----|
| 0% test coverage | Can't validate changes | Add tests |
| No helmet | Missing security headers | Register plugin |
| No process handlers | Silent crashes | Add handlers |
| No repository layer | Untestable, violates SRP | Create repositories |
| No DI container | New instance per request | Create container |
| No buildApp() | Can't test via inject | Separate bootstrap |

### Compliance by Rule File
| Rule | Current | Target |
|------|---------|--------|
| testing.md | 0% | 80% |
| security.md | 70% | 95% |
| services.md | 60% | 90% |
| fastify.md | 75% | 95% |
| mongodb.md | 75% | 90% |
| errors.md | 80% | 95% |

---

## Proposed Future State

### Architecture After Refactor

```
api/src/
├── app.ts                    # buildApp() - creates configured Fastify instance
├── server.ts                 # Starts server, process handlers (new)
├── index.ts                  # Entry point, calls server.ts
├── container.ts              # Service container with DI (new)
├── plugins/
│   ├── mongodb.ts            # + createIndexes() on ready
│   ├── helmet.ts             # NEW - security headers
│   └── ...
├── repositories/             # NEW - Data access layer
│   ├── video.repository.ts
│   ├── folder.repository.ts
│   ├── memorize.repository.ts
│   └── user.repository.ts
├── services/                 # Business logic only
│   ├── video.service.ts      # Refactored, uses repository
│   └── ...
├── routes/                   # HTTP layer, uses container
└── __tests__/                # NEW - Test suite
    ├── setup.ts
    ├── factories/
    ├── routes/
    └── services/
```

### Key Architectural Changes

1. **Separation of Concerns**
   - `app.ts`: Creates and configures Fastify (testable)
   - `server.ts`: Starts server, handles signals (production)
   - Services: Business logic only
   - Repositories: Data access only

2. **Dependency Injection**
   - `container.ts` creates all services/repositories
   - Container decorated onto Fastify instance
   - Routes access via `fastify.container`

3. **Repository Pattern**
   - All `db.collection()` calls move to repositories
   - Repositories return domain entities (not documents)
   - Services receive repositories via DI

4. **Testability**
   - `buildApp()` enables `app.inject()` testing
   - DI allows mocking dependencies
   - Factories for test data

---

## Implementation Phases

### Phase 1: Security Hardening (S - 2-3 hours)
*Immediate fixes that don't require architectural changes*

**Tasks:**
1. Register helmet plugin with proper CSP config
2. Add process.on('unhandledRejection') handler
3. Add process.on('uncaughtException') handler
4. Add graceful shutdown (SIGTERM/SIGINT)
5. Add rate limiting to playlist import endpoint
6. Fix linear retry backoff → exponential

**Success Criteria:**
- Security headers present in all responses
- Process errors logged before exit
- Graceful shutdown works

### Phase 2: Bootstrap Refactor (M - 4-6 hours)
*Enable testability without changing business logic*

**Tasks:**
1. Extract `buildApp()` into `app.ts`
2. Create `server.ts` for startup logic
3. Update `index.ts` to use new structure
4. Create service container in `container.ts`
5. Decorate container onto Fastify instance
6. Update routes to use `fastify.container`
7. Create MongoDB indexes on app ready

**Success Criteria:**
- `buildApp()` returns configured Fastify instance
- Can test with `app.inject()` without starting server
- Services accessed via container, not instantiated in routes

### Phase 3: Repository Layer (L - 8-12 hours)
*Separate data access from business logic*

**Tasks:**
1. Create `VideoRepository` with CRUD methods
2. Create `FolderRepository`
3. Create `MemorizeRepository`
4. Create `UserRepository`
5. Add entity/DTO conversions in repositories
6. Refactor `VideoService` to use repository
7. Refactor `FolderService` to class + repository
8. Refactor `MemorizeService` to use repository
9. Refactor `PlaylistService` to inject VideoService
10. Replace console loggers with Fastify logger injection

**Success Criteria:**
- No `db.collection()` calls in services
- All repositories return domain entities
- Services receive dependencies via constructor
- Structured logging with request correlation

### Phase 4: Test Suite (L - 8-12 hours)
*Achieve 80% coverage on new code*

**Tasks:**
1. Set up Vitest with coverage config
2. Create test setup with in-memory MongoDB
3. Create test factories (user, video, folder, memorize)
4. Write route integration tests (auth, videos, folders)
5. Write service unit tests (video, folder, memorize)
6. Write repository unit tests
7. Configure CI to run tests
8. Add pre-commit hook for tests

**Success Criteria:**
- 80% coverage on src/
- Tests run in CI
- All existing functionality verified

---

## Risk Assessment

### High Risk
| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Integration tests before refactor, incremental changes |
| Database migration issues | No schema changes, only code reorganization |

### Medium Risk
| Risk | Mitigation |
|------|------------|
| Performance regression | Benchmark critical paths before/after |
| DI container complexity | Keep container simple, avoid over-engineering |

### Low Risk
| Risk | Mitigation |
|------|------------|
| Learning curve for team | Document patterns, review code together |

---

## Success Metrics

| Metric | Before | After | Measurement |
|--------|--------|-------|-------------|
| Test Coverage | 0% | 80%+ | `npm run test:coverage` |
| Security Headers | 0 | 6+ | `curl -I /health` |
| Process Handlers | No | Yes | Kill -9 logs error |
| Build Time | N/A | <30s | CI timing |
| Type Errors | 0 | 0 | `npm run typecheck` |

---

## Required Resources

### Dependencies to Add
```json
{
  "devDependencies": {
    "vitest": "^2.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "mongodb-memory-server": "^10.0.0"
  }
}
```

### Files to Create
- `api/src/app.ts` (buildApp function)
- `api/src/server.ts` (server startup)
- `api/src/container.ts` (DI container)
- `api/src/plugins/helmet.ts` (security headers)
- `api/src/repositories/*.ts` (4 repositories)
- `api/src/__tests__/**/*.test.ts` (test files)

### Files to Modify
- `api/src/index.ts` (simplify to import server)
- `api/src/plugins/mongodb.ts` (add index creation)
- `api/src/services/*.ts` (use repositories via DI)
- `api/src/routes/*.ts` (use container)

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Security | 2-3 hours | None |
| Phase 2: Bootstrap | 4-6 hours | Phase 1 |
| Phase 3: Repository | 8-12 hours | Phase 2 |
| Phase 4: Tests | 8-12 hours | Phase 3 |

**Total:** 5-7 developer-days

**Recommended Approach:** Complete Phase 1 immediately (security). Phase 2-4 can be done incrementally alongside feature work.

---

## Verification Checklist

After completion:

```bash
# Security headers
curl -I http://localhost:3000/health | grep -E "X-Frame|Strict-Transport|Content-Security"

# Process handlers
kill -15 $(pgrep -f "node.*api") # Should log graceful shutdown

# Tests
cd api && npm test && npm run test:coverage

# Type safety
npm run typecheck

# All endpoints working
npm run test:e2e
```

---

## References

- [SKILL.md](/.claude/skills/backend-node/SKILL.md) - SOLID principles
- [fastify.md](/.claude/skills/backend-node/resources/fastify.md) - buildApp pattern
- [services.md](/.claude/skills/backend-node/resources/services.md) - DI container pattern
- [testing.md](/.claude/skills/backend-node/resources/testing.md) - Test structure
- [DATA-MODELS.md](/docs/DATA-MODELS.md) - MongoDB indexes
