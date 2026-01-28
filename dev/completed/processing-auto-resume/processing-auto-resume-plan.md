# Plan: Video Processing Auto-Resume & Sidebar Sync

**Last Updated**: 2026-01-28
**Status**: Ready for Implementation
**Effort**: Medium (M) - 3 phases, ~8 hours

---

## Executive Summary

Fix critical UX issues where video processing doesn't auto-resume after browser refresh and sidebar shows stale data (titles showing "Processing..." when actual title exists, completion status not syncing).

**Core Solution**: Create an app-level Processing Manager that automatically starts SSE streams for ALL processing videos on app load, eliminating the need for users to click into each video.

---

## Problem Statement

After browser refresh:
1. **Processing videos don't auto-resume** - User must click into each video to restart streaming
2. **Sidebar shows stale titles** - Shows "Processing..." even when title is available in DB
3. **Status out of sync** - Completed videos still show "processing" in sidebar
4. **No live updates** - Sidebar doesn't update as streaming progresses

---

## Current State Analysis

### Existing Architecture
```
┌─────────────────┐    WebSocket     ┌──────────────────┐
│   Summarizer    │ ──status event─▶ │   API Server     │
│                 │                  │                  │
│  /summarize     │                  │  /internal/status│
│  /stream/{id}   │                  │  broadcasts WS   │
└────────┬────────┘                  └────────┬─────────┘
         │                                    │
         │ SSE                           WebSocket
         ▼                                    ▼
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                           │
│  ┌──────────────┐   ┌───────────────────────────────┐  │
│  │  Sidebar     │   │   VideoDetailPage             │  │
│  │  - useAllVideos()│   - useSummaryStream() ─────┼──┼─▶ SSE
│  │  - shows list    │   - handles events            │  │
│  └──────────────┘   └───────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Identified Gaps

| Gap | Description | Impact |
|-----|-------------|--------|
| No App-Level Stream Manager | SSE only starts when navigating to VideoDetailPage | Must click each video to resume |
| Metadata Persistence Silent | Backend saves title but doesn't notify frontend | Sidebar never shows title |
| Completion Events Not Syncing | Status events work but sidebar shows old status | Confusing UX |

---

## Proposed Future State

### New Architecture
```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                           │
│  ┌────────────────────────────────────────────────────┐│
│  │              useProcessingManager (App Root)        ││
│  │  - Watches video list for processing videos         ││
│  │  - Auto-starts SSE streams for ALL processing       ││
│  │  - Manages concurrent streams                       ││
│  │  - Exposes stream state via Zustand store           ││
│  └────────────────────┬───────────────────────────────┘│
│                       │                                 │
│  ┌──────────────┐     │     ┌───────────────────────┐  │
│  │  Sidebar     │◀────┼─────│   VideoDetailPage     │  │
│  │  - Refetches │     │     │   - Uses shared state │  │
│  │    on events │     │     │   - No duplicate SSE  │  │
│  └──────────────┘     │     └───────────────────────┘  │
└───────────────────────┼─────────────────────────────────┘
                        │ SSE (one per processing video)
                        ▼
              ┌──────────────────┐
              │   API Server     │ ── WebSocket events
              │   /stream/{id}   │    for metadata/status
              └──────────────────┘
```

---

## Implementation Phases

### Phase 1: Backend WebSocket Enhancement
**Effort**: Small (S) - ~1 hour

Emit WebSocket events when metadata is persisted during SSE streaming so frontend can refetch.

**Files**:
- `api/src/routes/stream.routes.ts` - Add WebSocket broadcast
- `api/src/plugins/websocket.ts` - Verify broadcast available

### Phase 2: Frontend Processing Manager
**Effort**: Medium (M) - ~4 hours

Create the core `useProcessingManager` hook and Zustand store.

**Files**:
- `apps/web/src/hooks/use-processing-manager.ts` (NEW)
- `apps/web/src/stores/processing-store.ts` (NEW)
- `apps/web/src/App.tsx` - Initialize hook
- `apps/web/src/hooks/use-websocket.ts` - Handle metadata events

### Phase 3: Integration & Testing
**Effort**: Small (S) - ~3 hours

Integrate VideoDetailPage with processing manager and verify all scenarios.

**Files**:
- `apps/web/src/pages/VideoDetailPage.tsx` - Use shared state
- `apps/web/src/hooks/use-summary-stream.ts` - Export helpers

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Memory leaks from unclosed streams | Medium | High | Track all streams in Map, cleanup on unmount |
| Duplicate SSE connections | Medium | Medium | Check existing streams before starting new |
| Race conditions on rapid navigation | Low | Medium | Use refs and proper cleanup in useEffect |
| WebSocket message ordering | Low | Low | Query invalidation is idempotent |

---

## Success Metrics

1. **Auto-resume**: Processing videos automatically continue after refresh without user action
2. **Title sync**: Sidebar shows actual title within 2s of metadata arrival
3. **Status sync**: Completion status updates in sidebar within 1s
4. **No duplicate streams**: Only one SSE connection per processing video
5. **Memory stability**: No memory leaks after 10+ videos processed

---

## Required Resources

### Dependencies
- Existing: React Query, Zustand, WebSocket
- No new packages required

### Key Files
- `api/src/routes/stream.routes.ts` - SSE proxy with metadata persistence
- `api/src/plugins/websocket.ts` - WebSocket broadcast function
- `apps/web/src/hooks/use-summary-stream.ts` - SSE client logic
- `apps/web/src/hooks/use-websocket.ts` - WebSocket client
- `apps/web/src/App.tsx` - App root for hook initialization

---

## Timeline Estimate

| Phase | Effort | Duration |
|-------|--------|----------|
| Phase 1: Backend | S | ~1 hour |
| Phase 2: Frontend | M | ~4 hours |
| Phase 3: Integration | S | ~3 hours |
| **Total** | **M** | **~8 hours** |
