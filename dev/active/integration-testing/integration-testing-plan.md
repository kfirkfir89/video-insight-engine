# Integration Testing Implementation Plan

**Last Updated:** 2026-01-08
**Status:** Complete

---

## Executive Summary

This task implements integration test scripts to validate that all Video Insight Engine services work together correctly. The testing infrastructure is implemented in bash/curl for portability, with Node.js for WebSocket tests.

---

## Scope

| Phase | Description            | Status    |
| ----- | ---------------------- | --------- |
| 0     | Prerequisites Check    | Complete  |
| 1     | Service Startup        | Complete  |
| 2     | Health Checks          | Complete  |
| 3     | Auth Flow              | Complete  |
| 4     | Video Flow             | Complete  |
| 5     | Explain Flow           | **SKIP**  |
| 6     | E2E Journey            | Complete  |
| 7     | WebSocket Tests        | Complete  |
| 8     | Cleanup                | Complete  |

---

## Deliverables

### Test Scripts

```
scripts/integration/
├── lib/
│   ├── test-utils.sh      # Assertions, colors, HTTP helpers
│   └── config.sh          # URLs, timeouts, test data
├── 00-check-prereqs.sh    # Verify tools installed
├── 01-start-services.sh   # Docker compose with health wait
├── 02-health-check.sh     # All endpoints responding
├── 03-auth-flow.sh        # Register/login/refresh/logout
├── 04-video-flow.sh       # Submit/process/cache
├── 05-explain-flow.sh     # Document skip (stub)
├── 06-e2e-journey.sh      # Complete user journey
├── 07-ws-test.js          # WebSocket connection tests
├── 08-cleanup.sh          # Remove test data
└── run-all.sh             # Execute all phases
```

### Documentation

```
docs/INTEGRATION-TESTING.md
```

---

## Design Decisions

### 1. Bash over Node.js for Most Tests

**Decision:** Use bash scripts with curl/jq instead of Node.js test frameworks.

**Rationale:**
- No additional dependencies needed
- Easy to run in CI/CD environments
- Portable across systems
- Clear, readable output

### 2. Phase 5 (Explain) Skipped

**Decision:** Skip explain flow tests - document as blocked.

**Rationale:**
- `api/src/routes/explain.routes.ts` returns stub responses
- MCP integration between vie-api and vie-explainer not implemented
- Separate implementation task required

### 3. Shared Library Pattern

**Decision:** Extract common functions into `lib/` directory.

**Rationale:**
- DRY - assertions, HTTP helpers, config reused
- Consistent output formatting
- Easy to maintain

### 4. Test User Cleanup Pattern

**Decision:** Use email prefixes for test users: `integration-test-*`, `e2e-*`, `ws-test-*`

**Rationale:**
- Easy to identify test data
- Safe cleanup without affecting real users
- Timestamp suffix ensures uniqueness

---

## Risk Assessment

| Risk                        | Mitigation                                      |
| --------------------------- | ----------------------------------------------- |
| Video processing timeout    | Configurable timeout, use cached videos         |
| API key missing             | Clear error message in prerequisites            |
| Service startup failure     | Detailed health check logging                   |
| MongoDB cleanup incomplete  | Document manual cleanup steps                   |

---

## Success Criteria

- [x] All scripts are executable
- [x] Prerequisites check passes
- [x] Health checks verify all services
- [x] Auth flow tests cover registration/login/logout
- [x] Video flow tests cover submit/process/cache
- [x] E2E journey completes full workflow
- [x] WebSocket tests verify connection
- [x] Cleanup removes test data
- [x] Documentation explains usage

---

## Usage

```bash
# Run all tests
./scripts/integration/run-all.sh

# Run individual phase
./scripts/integration/03-auth-flow.sh

# Run with services already running
./scripts/integration/run-all.sh --skip-start

# Run and stop after
./scripts/integration/run-all.sh --stop-after
```
