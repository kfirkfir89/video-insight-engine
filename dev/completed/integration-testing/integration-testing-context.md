# Integration Testing - Context

**Last Updated:** 2026-01-09 (Session 3)

---

## Session 3 Summary (Current Session)

This session focused on **running and fixing integration tests**:

### Test Suite Results (All Passing)

| Phase | Test | Result |
|-------|------|--------|
| Phase 2 | Health Checks | **16/16 PASS** |
| Phase 3 | Auth Flow | **21/21 PASS** |
| Phase 4 | Video Flow | **15/16 PASS** (1 skipped) |
| Phase 5 | Explain Flow | **5 SKIPPED** (MCP not implemented) |
| Phase 6 | E2E Journey | **10/10 PASS** |
| Phase 7 | WebSocket | **6/6 PASS** |

### Fixes Applied This Session

1. **MongoDB ping test** (`scripts/integration/02-health-check.sh:74`)
   - **Problem:** Grep pattern `"ok".*1` didn't match `{ ok: 1 }` output
   - **Fix:** Changed to `ok.*1`

2. **Error response field check** (`scripts/integration/03-auth-flow.sh:60`)
   - **Problem:** Test expected `.error` field but API returns `.code`
   - **Fix:** Changed assertion from `.error` to `.code`
   - **API response format:** `{"code":"EMAIL_EXISTS","status":409}`

3. **Installed ws package** for WebSocket tests
   - Command: `pnpm add ws -D -w`

---

## Previous Sessions Summary

### Session 2 - Bug Fixes and Frontend Improvements

1. **Real-time WebSocket Updates** - Videos stuck in "pending" until page refresh
   - **Root cause:** Frontend had NO WebSocket listener
   - **Fix:** Created `apps/web/src/hooks/use-websocket.ts`
   - **Integration:** Added `useWebSocket()` hook to `App.tsx` → invalidates React Query on status changes

2. **Video List Missing Metadata** - Videos showed "Loading..." instead of title/channel
   - **Root cause:** `userVideos` collection didn't have title/channel/thumbnailUrl when first created
   - **Fix:** Added MongoDB `$lookup` aggregation in `api/src/services/video.service.ts:getVideos()`

3. **Video Detail Page Missing** - Clicking video card redirected to home
   - **Root cause:** No route for `/video/:id` - catch-all redirected everything
   - **Fix:** Created `apps/web/src/pages/VideoDetailPage.tsx` and added route

4. **Dark Mode Theme Not Working**
   - **Root cause:** Tailwind v4 `@theme inline` doesn't work with separate `.dark {}` CSS block
   - **Fix:** Restructured CSS in `apps/web/src/index.css` to use CSS custom properties in `:root` and `.dark`, then reference them in `@theme inline`

5. **YouTube-inspired Theme** - Added red accent color
   - Light mode: Red primary button (`oklch(55% 0.25 29)`)
   - Dark mode: YouTube red (`oklch(62.8% 0.258 29.23)`), deep dark background (`oklch(13.5% 0 0)`)

### Session 1 - Initial Implementation

Created entire integration test framework in `scripts/integration/`.

---

## Key Files Modified (All Sessions)

| File | Changes |
|------|---------|
| `apps/web/src/hooks/use-websocket.ts` | **NEW** - WebSocket hook for real-time updates |
| `apps/web/src/App.tsx` | Added useWebSocket hook, VideoDetailPage route |
| `apps/web/src/pages/VideoDetailPage.tsx` | **ENHANCED** - Video detail with embedded player |
| `api/src/services/video.service.ts` | Fixed `getVideos()` with MongoDB $lookup aggregation |
| `apps/web/src/index.css` | Restructured for Tailwind v4 dark mode + YouTube theme |
| `apps/web/src/pages/LoginPage.tsx` | Added Admin Login button |
| `apps/web/src/components/videos/YouTubePlayer.tsx` | Converted from react-youtube to plain iframe |
| `apps/web/Dockerfile` | Fixed to use pnpm for monorepo workspace dependencies |
| `scripts/integration/02-health-check.sh` | Fixed MongoDB ping grep pattern |
| `scripts/integration/03-auth-flow.sh` | Fixed error response field assertion |

---

## Integration Test Scripts

| File                                         | Purpose                        |
| -------------------------------------------- | ------------------------------ |
| `scripts/integration/lib/test-utils.sh`      | Assertions, colors, helpers    |
| `scripts/integration/lib/config.sh`          | URLs, timeouts, test config    |
| `scripts/integration/00-check-prereqs.sh`    | Prerequisites verification     |
| `scripts/integration/01-start-services.sh`   | Docker compose startup         |
| `scripts/integration/02-health-check.sh`     | Service health validation      |
| `scripts/integration/03-auth-flow.sh`        | Authentication flow tests      |
| `scripts/integration/04-video-flow.sh`       | Video submission tests         |
| `scripts/integration/05-explain-flow.sh`     | Explain flow skip document     |
| `scripts/integration/06-e2e-journey.sh`      | Full E2E journey               |
| `scripts/integration/07-ws-test.js`          | WebSocket connection tests     |
| `scripts/integration/08-cleanup.sh`          | Test data cleanup              |
| `scripts/integration/run-all.sh`             | Test runner                    |
| `docs/INTEGRATION-TESTING.md`                | Usage documentation            |

---

## Critical Architecture Decisions

### WebSocket Real-time Flow

```
Summarizer completes → POST /internal/status → API broadcasts via WebSocket →
Frontend receives event → Invalidates React Query → UI updates automatically
```

### CSS Theme Structure (Tailwind v4)

```css
/* CSS custom properties in :root and .dark */
:root { --background: oklch(99% 0 0); ... }
.dark { --background: oklch(13.5% 0 0); ... }

/* @theme inline references them */
@theme inline { --color-background: var(--background); ... }
```

---

## Known Issues / Blockers

### 1. Explain Flow Not Implemented
- **Location:** `api/src/routes/explain.routes.ts`
- **Status:** Returns stub response
- **Impact:** Integration test Phase 5 skipped

### 2. Rate Limiting on Tests
- Running full test suite back-to-back can trigger 429 rate limit on video submissions
- **Workaround:** Wait between test runs or run phases individually

---

## Test Data

| Item              | Value                                                     |
| ----------------- | --------------------------------------------------------- |
| Test email prefix | `integration-test-`, `e2e-`, `ws-test-`                  |
| Test password     | `TestPass123!`                                            |
| Admin account     | `admin@admin.com` / `Admin123`                            |
| Test video URL    | `https://www.youtube.com/watch?v=dQw4w9WgXcQ`            |
| Temp files        | `/tmp/vie-integration-*.txt`                              |

---

## Service Ports

| Service        | Port  | Health Endpoint      |
| -------------- | ----- | -------------------- |
| vie-api        | 3000  | GET /health          |
| vie-summarizer | 8000  | GET /health          |
| vie-explainer  | 8001  | (MCP stdio)          |
| vie-mongodb    | 27017 | mongosh ping         |
| vie-web        | 5173  | GET / (HTML)         |

---

## Commands Reference

```bash
# Start all services
docker-compose up -d

# Run individual test phases
./scripts/integration/02-health-check.sh
./scripts/integration/03-auth-flow.sh
./scripts/integration/04-video-flow.sh
./scripts/integration/06-e2e-journey.sh
node ./scripts/integration/07-ws-test.js

# Run full suite (services already running)
./scripts/integration/run-all.sh --skip-start

# Run full suite (start services first)
./scripts/integration/run-all.sh
```

---

## Next Steps

1. **Commit all changes** - Many uncommitted files spanning multiple sessions
2. **Consider implementing explain flow** (MCP integration) - Phase 5 currently skipped
3. **Add Playwright browser tests** - `apps/web/playwright.config.ts` exists but no tests yet
