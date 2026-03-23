# Integration + Advanced Features — Context

Last Updated: 2026-03-19

## Key Files

### Types & Contracts
- `packages/types/src/api.ts` — SSE event types (v1 + partial v2), WebSocket events
- `packages/types/src/vie-response.ts` — VIEResponse, TabEntry, domain data interfaces, VIEResponseMeta
- `packages/types/src/index.ts` — Re-exports

### Frontend SSE Consumer (existing v1)
- `apps/web/src/hooks/use-summary-stream.ts` — Current SSE hook (phase-based: triage, extraction, enrichment, synthesis, done)
- `apps/web/src/lib/stream-event-processor.ts` — Event dispatcher
- `apps/web/src/lib/stream-cache.ts` — LocalStorage stream cache
- `apps/web/src/stores/processing-store.ts` — Zustand store for stream state

### Frontend Output (v2 — already built)
- `apps/web/src/components/video-detail/output/ComposableOutput.tsx` — Renders tabs from VIEResponse
- `apps/web/src/components/video-detail/output/TabLayout.tsx` — Tab navigation
- `apps/web/src/components/video-detail/shell/TabCoordinationContext.tsx` — Cross-tab state
- `apps/web/src/components/video-detail/output/interactive/index.ts` — COMPONENT_REGISTRY (17 interactives)
- `apps/web/src/components/video-detail/OutputRouter.tsx` — Routes v1/v2 responses

### Frontend Pages
- `apps/web/src/pages/VideoDetailPage.tsx` — Main video view
- `apps/web/src/pages/GeneratePage.tsx` — URL input page
- `apps/web/src/pages/BoardPage.tsx` — Video grid

### Backend SSE (where events originate)
- `services/summarizer/src/routes/stream.py` — Pipeline SSE endpoint
- `services/summarizer/src/services/pipeline/assembly.py` — Produces TabEntry[]
- `services/summarizer/src/models/vie_response_v2.py` — Pydantic TabEntry, VIEResponseMeta

### API Gateway
- `api/src/routes/stream.routes.ts` — Proxies SSE from summarizer to frontend
- `api/src/services/video.service.ts` — Video CRUD, summary management

### Infrastructure
- `docker-compose.yml` — All services (MongoDB, Qdrant, Redis added)
- `services/summarizer/src/services/cache/response_cache.py` — Redis cache
- `services/summarizer/src/services/vector/qdrant_service.py` — Vector search

---

## Dependencies Between Terminals

| This Task | Depends On | Status |
|-----------|-----------|--------|
| Session 1: SSE Consumer | Types only (no backend needed) | Can start NOW |
| Session 2: E2E Testing | Backend pipeline complete + Infrastructure up | Wait |
| Session 3: Collections | API gateway available | Can start independently |
| Session 4: Assistant | Qdrant service + Embeddings working | Wait for infra |
| Session 5: Translation | LLM service available | Can start independently |
| Session 6: Diarization | Audio download + manifest stage | Wait for backend |
| Session 7: Prompt Variants | Extraction pipeline working | Wait for backend |

---

## SSE Event Contract (v2)

### Events emitted by backend (stream.py)
```
meta         → VIEResponseMeta + tabCount + tabLabels
tab_ready    → TabEntry + index (one per tab, streamed as ready)
synthesis    → { tldr, seoDescription, keyTakeaways }
frames       → { videoId, frames[] }  (if frame extraction enabled)
complete     → { tabCount, processingTimeMs, cached }
error        → { message, stage, recoverable }
```

### Existing v2 types in api.ts (already defined)
- `SSEMetaEvent` — has title, contentTags, modifiers, primaryTag, tabCount, tabLabels
- `SSETabReadyEvent` — has id, label, emoji, component, props, crossTabLinks, index

### Types still needed
- `SSESynthesisEvent` — tldr, seoDescription, keyTakeaways
- `SSEFramesEvent` — videoId, frames[]
- `SSECompleteEvent` — extend existing SSEDoneEvent with tabCount, cached
- `SSEErrorEvent` — extend existing with stage, recoverable

---

## Key Decisions

1. **Don't create new SSE hook** — extend `use-summary-stream.ts` to handle both v1 and v2 events. The existing hook already manages EventSource lifecycle, auth token refresh, error handling, and caching.

2. **Collections live in vie-api** — not in summarizer. Collections are user data, same as folders. Follow existing folder pattern in `api/src/routes/`.

3. **Assistant proxies through vie-api** — same auth/rate-limit gateway as all user-facing endpoints. Actual RAG search happens in summarizer via internal HTTP call.

4. **Progressive rendering** — `meta` event triggers tab skeleton bar. Each `tab_ready` event adds a real tab. `synthesis` updates hero subtitle. This means OutputRouter/ComposableOutput must accept partial VIEResponse.

---

## Effort Estimates

| Session | Effort | Lines of Code | Test Count |
|---------|--------|--------------|------------|
| 1. SSE Consumer | M | ~300 | ~15 |
| 2. E2E Testing | L | ~500 (test code) | 8 scenarios |
| 3. Collections | M | ~400 (API + frontend) | ~20 |
| 4. Assistant | L | ~600 (API + RAG + frontend) | ~15 |
| 5. Translation | S | ~200 | ~10 |
| 6. Diarization | M | ~250 | ~8 |
| 7. Prompt Variants | S | ~50 | ~5 |
| 8. Interconnection + RecipePlayer | L | ~1200 | ~40 |

---

## Session 8: Key File References

### Files to Create
- `apps/web/src/contexts/TabStateContext.tsx` — Cross-tab item state context
- `apps/web/src/contexts/__tests__/tab-state-context.test.tsx` — Unit tests
- `apps/web/src/lib/ingredient-step-matcher.ts` — Ingredient→step text matching
- `apps/web/src/lib/__tests__/ingredient-step-matcher.test.ts` — Unit tests
- `apps/web/src/components/video-detail/output/RecipePlayer.tsx` — Orchestrator
- `apps/web/src/components/video-detail/output/RecipeIngredientPanel.tsx` — Left panel
- `apps/web/src/components/video-detail/output/RecipeStepView.tsx` — Right panel

### Files to Modify
- `apps/web/src/contexts/VideoPlayerContext.tsx` — Add currentTime polling
- `apps/web/src/components/video-detail/OutputRouter.tsx` — Mount TabStateProvider
- `apps/web/src/components/video-detail/output/ComposableOutput.tsx` — Pass currentTime, tabId, cooking mode
- `apps/web/src/components/video-detail/output/interactive/ChecklistInteractive.tsx` — Write to TabState
- `apps/web/src/components/video-detail/output/interactive/StepByStepInteractive.tsx` — Read/write TabState
- `apps/web/src/components/video-detail/output/interactive/TimelineExplorer.tsx` — Read completedSteps
- `apps/web/src/components/video-detail/output/interactive/FlashDeckInteractive.tsx` — Read/write TabState
- `apps/web/src/components/video-detail/output/interactive/QuizInteractive.tsx` — Read/write TabState

### Existing Code Patterns (follow these)
- **Context pattern:** `TabCoordinationContext.tsx` — createContext + typed hook + provider with videoId reset
- **NOOP fallback:** `VideoPlayerContext.tsx` — returns NOOP_CONTEXT when outside provider (don't throw)
- **Component registry:** `ComposableOutput.tsx` — COMPONENT_REGISTRY maps component→renderer, NavProps passed down
- **Timer:** `components/vie/data/Timer.tsx` — `{duration, autoStart?, onComplete?, className}`, internal start/pause/reset
- **YouTubePlayer ref:** `YouTubePlayerRef.getCurrentTime()` available for polling

### Mounting Order (top→down)
```
ErrorBoundary
  VideoPlayerProvider          ← VideoDetailPage.tsx:187
    Layout
      CollapsibleVideoPlayer   ← uses VideoPlayerContext
      OutputRouter             ← VideoDetailPage.tsx:197
        TabCoordinationProvider  ← OutputRouter.tsx:86
          TabStateProvider       ← NEW (OutputRouter.tsx, inside TabCoordination)
            TabLayout            ← OutputRouter.tsx:90
              ComposableOutput   ← render-prop child
                COMPONENT_REGISTRY[tab.component](tab.props, nav)
```

### Component Internal State (current, before interconnection)
| Component | Local State | Will Add |
|-----------|-------------|----------|
| Checklist | `checked: Set<number>`, `servings: number` | Dual-write to TabState |
| StepPlayer | `currentStep: number`, `completedSteps: Set<number>` | Dual-write + read checkedItems |
| Timeline | `expanded: Set<number>`, `moodFilter: string` | Read completedSteps |
| FlashDeck | `shuffleIndices`, `currentCard`, `flipped`, `known: Set<number>`, `reviewed: Set<number>` | Dual-write known → masteredCards |
| Quiz | `currentIndex`, `answers: Map<number,number>`, `streak`, `maxStreak`, `shaking` | Write quizResults, read masteredCards |

### Critical Implementation Notes
1. **Dual-write pattern:** Components keep their local state as source of truth for rendering, AND write to TabStateContext for cross-tab communication. This ensures components still work independently when outside TabStateProvider (old cached videos, shared pages).
2. **useTabState fallback:** Unlike useTabCoordination (which throws), useTabState should return a NOOP_CONTEXT when outside provider — components must work without it.
3. **currentTime polling:** Use `setInterval(1000)` in VideoPlayerProvider, guarded by `isPlayerOpen`. Store interval ID in `useRef`. Clear on cleanup and when isPlayerOpen becomes false.
4. **RecipePlayer detection:** Check `tab.component === 'checklist'` AND `tab.component === 'step_player'`, not `dataSource`. Props come pre-assembled from backend.
5. **markTabCompleted wiring:** Components need to know their own tab ID. Pass `tabId={tab.id}` from COMPONENT_REGISTRY entries in ComposableOutput.
