# TDD Infrastructure - Context

**Last Updated**: 2026-02-02 10:00

## Current Session Summary

### Significant Progress Made

This session made substantial progress on the TDD infrastructure task. The test coverage has expanded significantly across all three services:

| Service | Before | After | Status |
|---------|--------|-------|--------|
| vie-api | 9 test files, 75 tests | 29 test files, 551 tests | ⚠️ 4 files failing (19 tests) |
| vie-web | 0 unit tests | 15 test files, 418 tests | ⚠️ 6 files failing (8 tests) |
| vie-summarizer | 3 test files | 12+ test files | ✅ Created (not run in container) |

### Test Infrastructure Status

#### vie-api (COMPLETE)
- Vitest configured and working
- 29 test files created
- Test helpers and factories established
- **Issues**: 4 test files have failures related to mocking/timing

#### vie-web (COMPLETE)
- Vitest configured with jsdom environment
- MSW server set up for API mocking
- Test utilities and providers created
- 15 test files created covering hooks, stores, utils, and API clients
- **Issues**: 6 test files have failures (8 total failing tests)

#### vie-summarizer (COMPLETE)
- pytest installed in requirements.txt
- pytest.ini configured
- conftest.py with shared fixtures
- 12 new test files created
- **Note**: Tests need to be run in Docker container

---

## Key Files Created/Modified This Session

### vie-api Tests Created
```
api/src/plugins/jwt.test.ts
api/src/plugins/mongodb.test.ts
api/src/plugins/rate-limit.test.ts
api/src/plugins/helmet.test.ts
api/src/plugins/websocket.test.ts
api/src/routes/stream.routes.test.ts
api/src/routes/memorize.routes.test.ts
api/src/routes/playlists.routes.test.ts
api/src/routes/internal.routes.test.ts
api/src/services/__tests__/auth.service.test.ts
api/src/services/__tests__/folder.service.test.ts
api/src/services/__tests__/memorize.service.test.ts
api/src/services/__tests__/playlist.service.test.ts
api/src/services/__tests__/summarizer-client.test.ts
api/src/services/__tests__/explainer-client.test.ts
api/src/repositories/__tests__/folder.repository.test.ts
api/src/repositories/__tests__/user.repository.test.ts
api/src/repositories/__tests__/memorize.repository.test.ts
api/src/utils/__tests__/youtube.test.ts
api/src/utils/__tests__/validation.test.ts
```

### vie-web Infrastructure & Tests Created
```
apps/web/vitest.config.ts
apps/web/src/test/setup.ts
apps/web/src/test/test-utils.tsx
apps/web/src/test/mocks/server.ts
apps/web/src/test/mocks/handlers.ts
apps/web/src/hooks/__tests__/use-videos.test.ts
apps/web/src/hooks/__tests__/use-folders.test.ts
apps/web/src/hooks/__tests__/use-summary-stream.test.ts
apps/web/src/hooks/__tests__/use-streaming-chat.test.ts
apps/web/src/stores/__tests__/auth-store.test.ts
apps/web/src/stores/__tests__/processing-store.test.ts
apps/web/src/api/__tests__/client.test.ts
apps/web/src/api/__tests__/auth.test.ts
apps/web/src/api/__tests__/videos.test.ts
apps/web/src/api/__tests__/folders.test.ts
apps/web/src/lib/__tests__/folder-utils.test.ts
apps/web/src/lib/__tests__/timestamp-utils.test.ts
apps/web/src/lib/__tests__/youtube-utils.test.ts
apps/web/src/lib/__tests__/sse-validators.test.ts
apps/web/src/lib/__tests__/utils.test.ts
```

### vie-summarizer Tests Created
```
services/summarizer/pytest.ini
services/summarizer/tests/conftest.py (updated)
services/summarizer/tests/test_youtube_service.py
services/summarizer/tests/test_transcript_service.py
services/summarizer/tests/test_whisper_transcriber.py
services/summarizer/tests/test_description_analyzer.py
services/summarizer/tests/test_playlist_service.py
services/summarizer/tests/test_sponsorblock.py
services/summarizer/tests/test_status_callback.py
services/summarizer/tests/test_stream_routes.py
```

---

## Key Decisions Made This Session

### Decision 1: Co-located Test Organization
**Chosen**: Mix of co-located tests and `__tests__` folders
**Rationale**:
- Simple tests (plugins, routes) co-located directly as `*.test.ts`
- Complex services/repositories in `__tests__/` subfolders
- Matches existing vie-api patterns

### Decision 2: MSW v2 for Frontend
**Chosen**: MSW v2 with proper async handlers
**Rationale**: Modern API mocking that works with React Query, handles SSE streams

### Decision 3: Shared Test Fixtures
**Chosen**: Use conftest.py (Python) and test/helpers.ts (Node) for shared fixtures
**Rationale**: Reduces duplication, ensures consistent test data

### Decision 4: Mock External Services
**Chosen**: Mock at HTTP boundary, not internal methods
**Rationale**: More realistic tests, catches integration issues

---

## Test Patterns Established

### vie-api Pattern
- Use `vi.fn()` for mocking dependencies
- Inject mocks via constructor (DI pattern)
- Use factories for test data (`createVideo()`, `createUser()`)
- Test error conditions explicitly

### vie-web Pattern
- Use MSW for API mocking
- Use `renderHook` with `createWrapper()` for hooks
- Test loading/error/success states
- Use `waitFor` for async state changes

### vie-summarizer Pattern
- Use `@pytest.fixture` for shared setup
- Use `AsyncMock` for async dependencies
- Use `pytest.mark.asyncio` for async tests
- Mock external services (YouTube, HTTP)

---

## Current Issues & Blockers

### Issue 1: vie-api Test Failures (4 files)
**Location**: `src/services/__tests__/summarizer-client.test.ts` and others
**Problem**: Timer mocking issues with retry logic
**Fix needed**: Adjust `vi.advanceTimersByTimeAsync()` usage for retry scenarios
**Impact**: 19 tests failing

### Issue 2: vie-web Test Failures (6 files)
**Location**: Various lib and hook tests
**Problem**:
- `extractVideoId()` function doesn't handle `v` param after other params
- Some hooks have timing issues with async state
**Fix needed**: Fix `extractVideoId` regex or function, adjust hook test timing
**Impact**: 8 tests failing

### Issue 3: vie-summarizer Tests Not Verified
**Location**: Docker container
**Problem**: Tests created but not run in container
**Command to verify**: `docker exec vie-summarizer python -m pytest`
**Impact**: Unknown - tests may pass or fail

---

## Dependencies Added

### vie-web (package.json)
```json
{
  "devDependencies": {
    "@testing-library/react": "^14.2.0",
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/user-event": "^14.5.0",
    "@vitest/coverage-v8": "^1.2.0",
    "jsdom": "^24.0.0",
    "msw": "^2.1.0"
  }
}
```

### vie-summarizer (requirements.txt)
```
pytest>=8.0.0
pytest-asyncio>=0.23.0
pytest-cov>=4.1.0
```

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [docs/SERVICE-API.md](../../../docs/SERVICE-API.md) | vie-api service details |
| [docs/SERVICE-SUMMARIZER.md](../../../docs/SERVICE-SUMMARIZER.md) | vie-summarizer details |
| [docs/FRONTEND.md](../../../docs/FRONTEND.md) | vie-web architecture |
| [.claude/skills/backend-node/resources/testing.md](../../../.claude/skills/backend-node/resources/testing.md) | Testing patterns |

---

## Handoff Notes for Next Session

### Immediate Next Steps

1. **Fix vie-api test failures** (Priority: High)
   - File: `api/src/services/__tests__/summarizer-client.test.ts`
   - Issue: Timer mocking for retry logic
   - Approach: Review how `vi.useFakeTimers()` interacts with async retry

2. **Fix vie-web test failures** (Priority: High)
   - File: `apps/web/src/lib/__tests__/youtube-utils.test.ts`
   - Issue: `extractVideoId()` fails when `v` param is not first
   - Fix: Update the source function or adjust test expectations

3. **Verify vie-summarizer tests** (Priority: Medium)
   - Command: `docker exec vie-summarizer python -m pytest -v`
   - May need to rebuild container: `docker-compose up -d --build vie-summarizer`

### Commands to Run on Resume

```bash
# Check current test status
cd api && npm test -- --run 2>&1 | grep -E "(FAIL|PASS|Tests)"

cd apps/web && npm test -- --run 2>&1 | grep -E "(FAIL|PASS|Tests)"

# Verify Python tests (in Docker)
docker exec vie-summarizer python -m pytest --co  # List tests
docker exec vie-summarizer python -m pytest -v    # Run tests
```

### Files Being Actively Worked On

None currently - tests were written, now need debugging.

### Uncommitted Changes

Many new test files are uncommitted. Check with:
```bash
git status
```

Consider committing stable tests and staging failing tests separately.
