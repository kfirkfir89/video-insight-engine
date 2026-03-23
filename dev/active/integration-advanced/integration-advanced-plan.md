# Integration + Advanced Features — Plan

Last Updated: 2026-03-19

## Executive Summary

Build the integration layer between backend pipeline (Terminal 1) and frontend components (already done), plus advanced features: Collections CRUD, Assistant RAG chat, Translation, Speaker Diarization, Category Prompt Variants, **Component Interconnection, and RecipePlayer**.

**Priority order:** SSE consumer → E2E testing → Prompt variants → **Component Interconnection → RecipePlayer** → Collections → Assistant → Translation → Diarization.

Sessions 1, 2, 7: DONE. Session 8 (Component Interconnection + RecipePlayer) starts now.

---

## Current State Analysis

### What Exists
- **Types:** `packages/types/src/vie-response.ts` has `VIEResponse`, `TabEntry`, `VIEResponseMeta`, domain data interfaces
- **SSE types (v2):** `packages/types/src/api.ts` has `SSEMetaEvent`, `SSETabReadyEvent` (partially)
- **Frontend components:** 17 interactive components in `apps/web/src/components/video-detail/output/interactive/`
- **Output shell:** `ComposableOutput.tsx`, `TabLayout.tsx`, `TabCoordinationContext.tsx`
- **VIE library:** 36 components in `apps/web/src/components/vie/`
- **Existing SSE hook:** `use-summary-stream.ts` — handles v1 events (phase, token, triage_complete, extraction_complete, done)
- **Processing store:** `processing-store.ts` — tracks stream state per videoSummaryId
- **Stream processor:** `stream-event-processor.ts` — dispatches SSE events to state
- **Pages:** `VideoDetailPage.tsx`, `GeneratePage.tsx`, `BoardPage.tsx`

### What Needs Building
1. **v2 SSE event types** — extend existing types for `meta`, `tab_ready`, `synthesis`, `frames`, `complete`
2. **v2 SSE consumer** — new hook or extend `use-summary-stream.ts` for progressive tab rendering
3. **Progressive rendering** — wire SSE state → `ComposableOutput` with skeleton tabs
4. **Collections API** — in `api/` (Fastify, not summarizer) per project architecture
5. **Assistant API** — in `api/` proxying to summarizer for RAG
6. **Translation service** — in summarizer, post-processing
7. **Diarization service** — in summarizer, pre-pipeline
8. **Category prompt variants** — simple injections into base_extraction.txt

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| SSE consumer extends existing hook | Don't create parallel system; evolve `use-summary-stream` to handle v2 events |
| Collections API in vie-api (Fastify) | All user-facing CRUD goes through api gateway, not direct to summarizer |
| Assistant in vie-api with summarizer proxy | Same auth gateway pattern; RAG search in summarizer, streaming through api |
| Translation in summarizer | Post-processing step, close to LLM service |
| Diarization conditional | Only when manifest detects multiple speakers, heavy dependency |

---

## Implementation Phases

### Phase 1: SSE Frontend Consumer (No Dependencies)
- Extend SSE event types in `packages/types/src/api.ts`
- Add v2 event handling to `use-summary-stream.ts` or new hook
- Wire progressive state to `ComposableOutput`
- Add skeleton tab bar from meta event
- Unit tests with mock EventSource

### Phase 2: End-to-End Testing (Depends: backend-pipeline, infrastructure-pipeline)
- 8 real videos across all domains
- SSE event order verification
- Interactive component behavior validation
- Cache hit/miss verification
- Performance benchmarks

### Phase 3: Collections CRUD
- MongoDB schema for collections
- Fastify routes in vie-api
- Frontend sidebar integration
- Collection-scoped video views

### Phase 4: Assistant Chat
- Qdrant RAG search endpoint in summarizer
- Streaming chat proxy in vie-api
- Frontend chat UI with inline interactives
- Collection-scoped search

### Phase 5: Translation Layer
- Translation service in summarizer
- Language-aware Redis caching
- Frontend language picker

### Phase 6: Speaker Diarization
- pyannote-audio integration
- Conditional trigger from manifest
- Transcript enrichment with speaker labels

### Phase 7: Category Prompt Variants
- Detail level injection (duration-based)
- Content emphasis injection (domain-based)

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Backend SSE contract mismatch | High | Define types first, validate with integration test |
| Qdrant not available for Assistant | Medium | Feature-flag Assistant, degrade to MongoDB text search |
| pyannote-audio heavy dependency | Low | Optional, conditional install, graceful fallback |
| Translation LLM cost | Medium | Cache aggressively, limit to UI strings only |
| EventSource browser compat | Low | All modern browsers support SSE; no polyfill needed |

---

## Success Metrics

- SSE consumer handles all 6 event types correctly
- Progressive rendering shows first tab within 2s of meta event
- 8/8 domain videos produce correct interactive output
- Cached response serves in <200ms
- Collections CRUD works with 100% test coverage
- Assistant answers reference actual video content
- Translation preserves code/numbers/URLs

---

## Session 8: Component Interconnection + RecipePlayer

### Goal

Make tabs feel like ONE connected app, not separate pages. Cross-tab state sharing lets components react to each other in real-time. Then build RecipePlayer — a dedicated cooking mode that combines checklist + steps + timer into one hands-free screen.

### Architecture

#### TabStateContext — Cross-Tab Item State

New context providing ephemeral session state (not persisted). Mounted inside `TabCoordinationProvider` in `OutputRouter.tsx`.

```
VideoPlayerProvider (VideoDetailPage)          ← seekTo, currentTime (NEW)
  └── TabCoordinationProvider (OutputRouter)   ← activeTab, completedTabs
        └── TabStateProvider (OutputRouter)    ← checkedItems, completedSteps, masteredCards, quizResults
              └── TabLayout
                    └── ComposableOutput → interactive components
```

**Interface:**
```typescript
interface TabStateContextType {
  checkedItems: Set<string>;         // "ingredients:0", "packing:3"
  completedSteps: Set<number>;       // step indices completed in StepPlayer
  masteredCards: Set<string>;        // card indices marked "got it" in FlashDeck
  quizResults: Map<string, boolean>; // questionIndex → correct/incorrect

  checkItem: (tabId: string, index: number) => void;
  uncheckItem: (tabId: string, index: number) => void;
  completeStep: (stepIndex: number) => void;
  uncompleteStep: (stepIndex: number) => void;
  masterCard: (cardIndex: string) => void;
  setQuizResult: (questionIndex: string, correct: boolean) => void;

  isChecked: (tabId: string, index: number) => boolean;
  isStepCompleted: (stepIndex: number) => boolean;
  getCompletionPercent: (tabId: string, totalItems: number) => number;
}
```

**Key decisions:**
- Items keyed by index (not name) to avoid collisions: `"ingredients:0"`, `"packing:3"`
- Resets on `videoId` change (like TabCoordinationContext)
- No persistence (ephemeral — resets on page reload)
- Separate from TabCoordinationContext (different granularity: item-level vs tab-level)
- Wire `markTabCompleted()` from TabCoordination when all items in a tab are done

#### VideoPlayerContext Enhancement — currentTime

Add `currentTime: number` state to `VideoPlayerContext`. Poll `playerRef.current.getCurrentTime()` on a 1-second interval when the player is open and playing. Stop polling when paused/closed.

This enables:
- Timeline active-entry highlight (already accepts `currentTime` prop but nothing provides it)
- Future "watched past timestamp" detection

#### Ingredient-Step Text Matching

Word-level matching: tokenize ingredient name, extract primary noun (strip common qualifiers like "fresh", "large", "dried", "ground"), check if it appears in step instruction text.

```typescript
// ingredient "fresh chicken breast" → match tokens: ["chicken", "breast"]
// step "Cut the chicken into chunks" → matches "chicken" ✓
```

Computed once via `useMemo` when component mounts. ~20 ingredients × ~15 steps = 300 comparisons — negligible.

#### RecipePlayer — Cooking Mode

NOT a COMPONENT_REGISTRY entry. A **mode** in the output area activated when:
1. `primaryTag === "food"`
2. Tabs include `component === "checklist"` with items
3. Tabs include `component === "step_player"` with steps

Split into 3 files:
- `RecipePlayer.tsx` — layout orchestrator (~100 lines)
- `RecipeIngredientPanel.tsx` — left panel with checklist
- `RecipeStepView.tsx` — right panel with step + timer + controls

Shares state with TabStateContext — checking an ingredient in RecipePlayer = checked in Checklist tab too.

### Interconnection Matrix

| Component | Reads from TabState | Writes to TabState | Side Effect |
|-----------|--------------------|--------------------|-------------|
| Checklist | — | `checkItem/uncheckItem` | `markTabCompleted` when all done |
| StepPlayer | `checkedItems` (ingredient readiness per step) | `completeStep` | `markTabCompleted` when all done |
| Timeline | `completedSteps` (checkmark overlay) | — | — |
| FlashDeck | `quizResults` (review flags) | `masterCard` | `markTabCompleted` when all reviewed |
| Quiz | `masteredCards` (studied badges) | `setQuizResult` | `markTabCompleted` when all answered |
| RecipePlayer | `checkedItems`, `completedSteps` | `checkItem`, `completeStep` | Shared state with tab views |

### Execution Phases

```
Phase 1: Foundation (plumbing, no visual changes)
  1.1 Create TabStateContext.tsx + useTabState hook
  1.2 Unit tests for TabStateContext
  1.3 Mount TabStateProvider in OutputRouter
  1.4 Add currentTime to VideoPlayerContext (poll on interval)
  1.5 Pass currentTime to TimelineExplorer via ComposableOutput

Phase 2: Checklist ↔ StepPlayer interconnection
  2.1 Update Checklist to write checkedItems to TabStateContext
  2.2 Create ingredient-step-matcher.ts utility
  2.3 Update StepPlayer to read checkedItems, show readiness per step
  2.4 Wire markTabCompleted for Checklist + StepPlayer

Phase 3: StepPlayer ↔ Timeline interconnection
  3.1 Update StepPlayer to write completedSteps to TabStateContext
  3.2 Update Timeline to read completedSteps, show checkmarks on entries

Phase 4: FlashDeck ↔ Quiz interconnection
  4.1 Update FlashDeck to write masteredCards
  4.2 Update Quiz to read masteredCards, show "studied" badges
  4.3 Update Quiz to write quizResults
  4.4 Update FlashDeck to read quizResults, show "review needed" flags

Phase 5: RecipePlayer
  5.1 Create RecipeIngredientPanel.tsx
  5.2 Create RecipeStepView.tsx
  5.3 Create RecipePlayer.tsx (orchestrator)
  5.4 Add cooking mode detection + toggle in output area
  5.5 Wire to TabStateContext + VideoPlayerContext
  5.6 Responsive layout (desktop two-column, mobile drawer)

Phase 6: Polish + Testing
  6.1 Animations for state changes
  6.2 Accessibility (keyboard nav, ARIA)
  6.3 Verify existing tests still pass
  6.4 Verify old cached videos render correctly
```

### Files to Create/Modify

| Action | File | What |
|--------|------|------|
| **Create** | `contexts/TabStateContext.tsx` | Cross-tab item state context + useTabState hook |
| **Create** | `contexts/__tests__/tab-state-context.test.tsx` | Unit tests for TabStateContext |
| **Create** | `lib/ingredient-step-matcher.ts` | Text matching: ingredient → step |
| **Create** | `lib/__tests__/ingredient-step-matcher.test.ts` | Unit tests for matcher |
| **Create** | `output/RecipePlayer.tsx` | Cooking mode orchestrator |
| **Create** | `output/RecipeIngredientPanel.tsx` | Left panel with ingredients |
| **Create** | `output/RecipeStepView.tsx` | Right panel with step + timer |
| **Modify** | `contexts/VideoPlayerContext.tsx` | Add currentTime polling |
| **Modify** | `video-detail/OutputRouter.tsx` | Mount TabStateProvider |
| **Modify** | `output/ComposableOutput.tsx` | Pass currentTime to TimelineExplorer |
| **Modify** | `interactive/ChecklistInteractive.tsx` | Write to TabStateContext |
| **Modify** | `interactive/StepByStepInteractive.tsx` | Read checkedItems, write completedSteps |
| **Modify** | `interactive/TimelineExplorer.tsx` | Read completedSteps, show checkmarks |
| **Modify** | `interactive/FlashDeckInteractive.tsx` | Read quizResults, write masteredCards |
| **Modify** | `interactive/QuizInteractive.tsx` | Read masteredCards, write quizResults |

All paths relative to `apps/web/src/`.

### What NOT to Build

- ❌ No new INTERACTIVE_REGISTRY entry — RecipePlayer is a mode
- ❌ No server state — TabStateContext is React context only
- ❌ No localStorage persistence for cross-tab state
- ❌ No SpotExplorer ↔ Budget interconnection (stretch goal)
- ❌ No backend changes — pure frontend
- ❌ No changes to domains.json or assembly.py

### Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Text matching quality (ingredient→step) | Medium | Word-level matching with qualifier stripping; Strategy B (assembly-time linking) as future backend enhancement |
| Timer UX (no external pause API) | Low | Timer component has internal start/pause/reset controls — sufficient for RecipePlayer; pass `autoStart` and `onComplete` props |
| currentTime polling performance | Low | 1s interval, only when player is open; useRef for interval ID, cleanup on unmount |
| RecipePlayer complexity | Medium | Split into 3 files; shared state via TabStateContext keeps each file <200 lines |
