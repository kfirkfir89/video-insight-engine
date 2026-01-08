# Development Scratchpad

**Last Updated:** 2026-01-09

---

## Session Handoff Notes

### What Was Being Worked On

**Task: Integration Testing** - Running and fixing integration test suite

**Status: COMPLETE** - All tests pass, task can be closed

### Test Results Summary

| Phase | Test | Result |
|-------|------|--------|
| Phase 2 | Health Checks | **16/16 PASS** |
| Phase 3 | Auth Flow | **21/21 PASS** |
| Phase 4 | Video Flow | **15/16 PASS** (1 skipped) |
| Phase 5 | Explain Flow | **5 SKIPPED** (MCP not implemented) |
| Phase 6 | E2E Journey | **10/10 PASS** |
| Phase 7 | WebSocket | **6/6 PASS** |

### Current State

- All services running via Docker Compose
- Integration tests fully functional
- Admin account exists: `admin@admin.com` / `Admin123`

### Commands to Run on Restart

```bash
# Start all services
cd /home/kfir/projects/video-insight-engine
docker-compose up -d

# Verify services are healthy
./scripts/integration/02-health-check.sh

# Run full test suite (services already running)
./scripts/integration/run-all.sh --skip-start

# Start frontend dev server (if needed)
cd apps/web && pnpm dev
```

---

## Recent Fixes (Session 3)

### 1. MongoDB Ping Test

**File:** `scripts/integration/02-health-check.sh:74`

**Problem:** Grep pattern `"ok".*1` didn't match `{ ok: 1 }` output (no quotes in mongosh output)

**Fix:** Changed to `ok.*1`

### 2. Error Response Field Assertion

**File:** `scripts/integration/03-auth-flow.sh:60`

**Problem:** Test expected `.error` field but API returns `.code`

**Fix:** Changed assertion from `.error` to `.code`

**API response format:** `{"code":"EMAIL_EXISTS","status":409}`

### 3. WebSocket Tests

**Problem:** `ws` package not installed

**Fix:** `pnpm add ws -D -w`

---

## Previous Session Fixes (Session 2)

### WebSocket Real-time Updates

**Problem:** Videos stuck in "pending" until manual page refresh

**Root Cause:** Backend was broadcasting WebSocket events but frontend had no listener

**Solution:**
```typescript
// apps/web/src/hooks/use-websocket.ts
export function useWebSocket() {
  // Connects to /ws?token={accessToken}
  // Listens for video.status events
  // Invalidates React Query cache on status change
}

// apps/web/src/App.tsx - added in AppRoutes()
useWebSocket();
```

### Video List Missing Metadata

**Problem:** Video cards showed "Loading..." instead of title/channel/thumbnail

**Root Cause:** `userVideos` collection doesn't have metadata when first created; it's in `videoSummaryCache`

**Solution:**
```typescript
// api/src/services/video.service.ts - getVideos()
const videos = await this.db.collection('userVideos').aggregate([
  { $match: matchStage },
  { $sort: { createdAt: -1 } },
  {
    $lookup: {
      from: 'videoSummaryCache',
      localField: 'videoSummaryId',
      foreignField: '_id',
      as: 'cache',
    },
  },
  { $unwind: { path: '$cache', preserveNullAndEmptyArrays: true } },
]).toArray();
```

### Tailwind v4 Dark Mode

**Problem:** `.dark` class applied but styles didn't change

**Root Cause:** `@theme inline` in Tailwind v4 creates static theme values, doesn't read CSS custom properties dynamically

**Solution:**
```css
/* Define CSS custom properties in :root and .dark */
:root { --background: oklch(99% 0 0); }
.dark { --background: oklch(13.5% 0 0); }

/* Reference them in @theme inline */
@theme inline { --color-background: var(--background); }
```

---

## Architecture Notes

### WebSocket Flow
```
Summarizer completes
  → POST /internal/status (status_callback.py)
  → API internal.routes.ts receives
  → fastify.broadcast(userId, event)
  → Frontend useWebSocket hook receives
  → Invalidates React Query
  → UI updates automatically
```

### Video Data Flow
```
User submits URL
  → API creates userVideos entry (status: pending)
  → API creates videoSummaryCache entry
  → Summarizer processes (background)
  → Summarizer updates videoSummaryCache with title/channel/thumbnail/summary
  → Status callback updates userVideos status
  → Frontend shows complete data via $lookup
```

---

## Files Modified (All Sessions)

| File | Purpose |
|------|---------|
| `apps/web/src/hooks/use-websocket.ts` | NEW - WebSocket hook |
| `apps/web/src/App.tsx` | Added useWebSocket, VideoDetailPage route |
| `apps/web/src/pages/VideoDetailPage.tsx` | Enhanced with player |
| `api/src/services/video.service.ts` | MongoDB $lookup fix |
| `apps/web/src/index.css` | Tailwind v4 dark mode + YouTube theme |
| `apps/web/src/pages/LoginPage.tsx` | Admin Login button |
| `apps/web/src/components/videos/YouTubePlayer.tsx` | Plain iframe (no react-youtube) |
| `apps/web/Dockerfile` | pnpm fix for monorepo |
| `scripts/integration/02-health-check.sh` | MongoDB ping grep fix |
| `scripts/integration/03-auth-flow.sh` | Error field assertion fix |

---

## Quick Reference

### Test Accounts
- Admin: `admin@admin.com` / `Admin123`
- Test prefix: `integration-test-*`, `e2e-*`, `ws-test-*`

### Service URLs
- Frontend: http://localhost:5173
- API: http://localhost:3000
- Summarizer: http://localhost:8000

### Key Files to Check
- WebSocket: `api/src/plugins/websocket.ts`, `apps/web/src/hooks/use-websocket.ts`
- Video service: `api/src/services/video.service.ts`
- Internal routes: `api/src/routes/internal.routes.ts`
- Theme: `apps/web/src/index.css`

---

## Uncommitted Changes

**IMPORTANT:** There are many uncommitted changes spanning multiple sessions. Run:

```bash
git status
git diff --stat
```

Key new/modified files to commit:
- `apps/web/src/hooks/use-websocket.ts` (NEW)
- `apps/web/src/pages/VideoDetailPage.tsx` (ENHANCED)
- `api/src/services/video.service.ts` (MODIFIED)
- `apps/web/src/index.css` (MODIFIED)
- `scripts/integration/*` (NEW - entire test framework)
- `dev/active/integration-testing/*` (UPDATED)

**Recommendation:** Review changes with `git diff` and commit when ready.

---

## Next Steps

1. **Commit all changes** - Many uncommitted files
2. **Consider moving task to completed** - `mv dev/active/integration-testing dev/completed/`
3. **Optional: Add Playwright browser tests** - Config exists at `apps/web/playwright.config.ts`
4. **Optional: Implement explain flow** - Phase 5 tests currently skipped
