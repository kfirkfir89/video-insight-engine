# Context: Video Processing Auto-Resume & Sidebar Sync

**Last Updated**: 2026-01-28

---

## Key Files

### Backend

| File | Purpose | Lines of Interest |
|------|---------|-------------------|
| `api/src/routes/stream.routes.ts` | SSE proxy, metadata persistence | 100-145 (event parsing) |
| `api/src/plugins/websocket.ts` | WebSocket server, broadcast function | 39-44 (broadcast) |
| `api/src/routes/internal.routes.ts` | Status webhook, WS broadcast | 52-81 (status handling) |

### Frontend - Hooks

| File | Purpose | Lines of Interest |
|------|---------|-------------------|
| `apps/web/src/hooks/use-summary-stream.ts` | SSE client for streaming | 294-400 (connect), 159-217 (cache) |
| `apps/web/src/hooks/use-websocket.ts` | WebSocket client | 62-84 (message handler), 97-145 (connect) |
| `apps/web/src/hooks/use-videos.ts` | Video queries, mutations | 6-28 (queries) |

### Frontend - Components

| File | Purpose | Lines of Interest |
|------|---------|-------------------|
| `apps/web/src/App.tsx` | App root, hook initialization | 85 (useWebSocket) |
| `apps/web/src/pages/VideoDetailPage.tsx` | Video detail, streaming | 23-51 (streaming setup) |
| `apps/web/src/components/sidebar/VideoItem.tsx` | Sidebar video display | 200, 217-232 (title, status) |
| `apps/web/src/components/sidebar/SidebarSection.tsx` | Video list fetch | 56-57 (useAllVideos) |

---

## Key Decisions

### 1. Zustand Store vs Context
**Decision**: Use Zustand store for processing state
**Rationale**:
- Already used in project (auth-store, ui-store)
- Better performance with selective subscriptions
- Easier to access outside React components

### 2. Stream Deduplication Strategy
**Decision**: Use `Map<videoSummaryId, StreamController>` in ref
**Rationale**:
- Prevents duplicate connections for same video
- Easy to check before starting new stream
- Cleanup is straightforward (delete from map)

### 3. WebSocket vs SSE for Metadata Notifications
**Decision**: Use WebSocket (existing) for metadata events
**Rationale**:
- WebSocket already connected at app level
- SSE is one-way from backend, can't easily trigger sidebar refetch
- Metadata events are infrequent, WebSocket overhead is minimal

---

## Data Flow

### Current Flow (Broken)
```
User adds video
    ↓
API creates video (status: pending)
    ↓
Summarizer starts processing
    ↓
SSE streams to... NOTHING (user not on detail page)
    ↓
Sidebar shows stale data
```

### Fixed Flow
```
User adds video
    ↓
API creates video (status: pending)
    ↓
useProcessingManager detects new processing video
    ↓
Starts SSE stream automatically
    ↓
On metadata event:
  1. Backend persists to DB
  2. Backend broadcasts WebSocket event
  3. Frontend invalidates query
  4. Sidebar shows title
    ↓
On done event:
  1. Invalidate queries
  2. Remove from activeStreams
  3. Sidebar shows completed
```

---

## WebSocket Event Types

### Existing
```typescript
interface VideoStatusEvent {
  type: "video.status";
  payload: {
    videoSummaryId: string;
    userVideoId?: string;
    status: "pending" | "processing" | "completed" | "failed";
    progress?: number;
    message?: string;
    error?: string | null;
  };
}
```

### New (to add)
```typescript
interface VideoMetadataEvent {
  type: "video.metadata";
  payload: {
    videoSummaryId: string;
    title: string;
    channel?: string;
    thumbnailUrl?: string;
    duration?: number;
  };
}
```

---

## Query Keys Reference

```typescript
// apps/web/src/lib/query-keys.ts
export const queryKeys = {
  videos: {
    lists: () => ["videos"] as const,
    list: (folderId?: string) => ["videos", "list", { folderId }] as const,
    detail: (id: string) => ["videos", "detail", id] as const,
  },
  // ...
};
```

---

## Existing Patterns to Follow

### Hook Pattern (use-websocket.ts)
```typescript
export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  // ...

  const handleMessage = useCallback((event: MessageEvent) => {
    const data = JSON.parse(event.data);
    if (data.type === "video.status") {
      queryClient.invalidateQueries({ queryKey: queryKeys.videos.lists() });
    }
  }, [queryClient]);
}
```

### Store Pattern (auth-store.ts)
```typescript
export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  // ...
  setTokens: (tokens) => set(tokens),
}));
```

---

## Dependencies

### Runtime
- `@tanstack/react-query` - Query invalidation
- `zustand` - State management
- Native `EventSource` - SSE client (via fetch in use-summary-stream)
- Native `WebSocket` - Real-time events

### Development
- No additional dev dependencies needed

---

## Testing Considerations

### Manual Test Scenarios
1. Add 3 videos, refresh immediately → All should resume
2. Add video, watch sidebar → Title should update automatically
3. Let video complete → Status should sync to sidebar
4. Navigate to detail page mid-stream → Should show current progress
5. Close tab and reopen → Should resume from where left off

### Edge Cases
- Video completes while user is offline → Should sync on reconnect
- Network disconnect during stream → Should reconnect with backoff
- Rapid add/delete of videos → Streams should cleanup properly

---

## Related Tasks

- `dev/active/progressive-summarization/` - Progressive loading feature (complete)
- `dev/active/transcript-system/` - Transcript handling (complete)
- Previous work: localStorage caching in use-summary-stream.ts
