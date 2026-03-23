# Integration + Advanced Features — Tasks

Last Updated: 2026-03-19

## Session 1: SSE Frontend Consumer ✅ DONE

### 1A. Extend SSE Event Types
- [x] Add `SSESynthesisEvent` to `packages/types/src/api.ts` (tldr, seoDescription, keyTakeaways)
- [x] Add `SSEFramesEvent` to `packages/types/src/api.ts` (videoId, frames[])
- [x] Extend `SSECompleteEvent` with cached field
- [x] Extend `SSEMetaEvent` with videoId, creator, userGoal, stats fields
- [x] Types already re-exported from `packages/types/src/index.ts`
- [x] Verify: types compile cleanly

### 1B. Extend Stream Event Processor — ALREADY IMPLEMENTED (v2 events)
- [x] v2 event handlers in `stream-event-processor.ts`: meta, tab_ready, complete (already existed)
- [x] v1 events still supported (triage_complete, extraction_complete, done)
- [x] `assembledTabs` accumulator in stream state (already existed)
- [x] `assembledMeta` in stream state (already existed)

### 1C. Extend use-summary-stream Hook
- [x] Added `tabCount` and `tabLabels` state fields
- [x] Meta event handler extracts tabCount + tabLabels from SSE
- [x] Stream cache updated with new fields
- [x] Unit tests updated (34 tests pass)

### 1D. Progressive Rendering Integration
- [x] `OutputRouter.tsx` — accepts `tabCount` and `tabLabels` props
- [x] Skeleton tab bar from `tabLabels` before tabs arrive
- [x] Loading indicator: "Loading tabs... (2/5)" during streaming
- [x] `VideoDetailPage.tsx` — passes new props to OutputRouter

### 1E. Verify Session 1
- [x] SSE types compile cleanly
- [x] Stream event processor tests: 34 pass
- [x] Progressive rendering UI elements added
- [x] All code has unit tests

---

## Session 2: End-to-End Testing ✅ DONE

### 2A. Playwright Layout & Overflow Tests
- [x] Fixed v1.5-layout-audit.spec.ts — updated selectors for new board/detail pages (was 14 failing → 0)
- [x] Fixed perf-layout-audit.spec.ts — updated selectors, added video detail mock (was 6 failing → 0)
- [x] Fixed output-layout.spec.ts — updated recipe mock to v2 assembled tabs format (was 2 failing → 0)
- [x] All 3 specs pass: 35 + 11 + 20 = 66 layout tests pass

### 2B-2D: Full E2E Domain Tests — v2 Assembled Tabs (domain-videos.spec.ts)
- [x] Learning video end-to-end (7 tests: key_points, concepts, takeaways, timestamps, quiz, flashcards, scenarios)
- [x] Tech video end-to-end (5 tests: overview, setup, code, patterns, cheat_sheet)
- [x] Food video end-to-end (4 tests: overview, ingredients, steps, tips)
- [x] Fitness video end-to-end (3 tests: overview, exercises, warmup/cooldown)
- [x] Music video end-to-end (4 tests: overview, analysis, structure/lyrics, credits)
- [x] Travel video end-to-end (4 tests: overview, itinerary, packing, budget)
- [x] Review video end-to-end (4 tests: overview, verdict, pros_cons, specs)
- [x] Project video end-to-end (4 tests: overview, materials, tools, steps)
- [x] Narrative modifier end-to-end (3 tests: key_moments, quotes, takeaways)
- [x] Cross-tab link navigation (4 tests: learning, food, review bidirectional, travel)
- [x] Performance targets validation (3 tests: initial render, tab switch, overflow)
- [x] Cache invalidation test (2 tests: reload, content update)
- [x] Progressive rendering (3 tests: no output fallback, TLDR/takeaways, footer)
- [x] Empty state handling (3 tests: null data, empty tabs, empty checklist)
- [x] Responsive layout (3 tests: mobile 375px, tablet 768px, desktop 1440px)
- [x] All 56 domain video E2E tests pass

---

## Session 3: Collections CRUD — NOT STARTED (EXCLUDED)

### 3A. MongoDB Schema
- [ ] Define Collection schema in `api/src/models/` or repository
- [ ] Fields: userId, name, description, videoIds[], createdAt, updatedAt
- [ ] Add MongoDB index on userId

### 3B. API Routes (vie-api / Fastify)
- [ ] `GET /api/collections` — list user's collections with video counts
- [ ] `POST /api/collections` — create collection (name, description)
- [ ] `GET /api/collections/:id` — get collection with videos
- [ ] `POST /api/collections/:id/videos/:videoId` — add video to collection
- [ ] `DELETE /api/collections/:id/videos/:videoId` — remove video from collection
- [ ] `DELETE /api/collections/:id` — delete collection (not videos)
- [ ] `GET /api/collections/uncategorized` — videos not in any collection
- [ ] Auth middleware on all routes
- [ ] Input validation (collection name length, valid ObjectIds)
- [ ] Unit tests for all routes (~12 tests)

### 3C. Frontend Integration
- [ ] Collections store (Zustand) — fetch, create, delete, add/remove video
- [ ] Update sidebar to show collections with counts
- [ ] Collection view page — grid of videos in collection
- [ ] "Add to collection" action on video cards
- [ ] "Uncategorized" section in sidebar

---

## Session 4: Assistant Chat — NOT STARTED (EXCLUDED)

### 4A. RAG Search Endpoint (summarizer)
- [ ] `POST /api/internal/search` — vector search across user's videos
- [ ] Accepts: query embedding, video_ids filter, limit
- [ ] Returns: ranked chunks with video_id, text, score

### 4B. Assistant API (vie-api)
- [ ] `POST /api/assistant/chat` — streaming chat endpoint
- [ ] Accepts: message, collection_id (optional)
- [ ] Get user's video IDs (or collection's video IDs)
- [ ] Call summarizer RAG search
- [ ] Build system prompt with video context + retrieved chunks
- [ ] Stream LLM response back to client
- [ ] Auth middleware + rate limiting

### 4C. Frontend Chat UI
- [ ] Chat page at `/assistant` route
- [ ] Message input with send button
- [ ] Streaming response display
- [ ] Detect inline JSON `{"interactive": true, "component": "...", "props": {...}}`
- [ ] Render interactive components inline in chat using COMPONENT_REGISTRY
- [ ] Optional: collection picker to scope search
- [ ] Unit tests for chat components (~8 tests)

---

## Session 5: Translation Layer — NOT STARTED (EXCLUDED)

### 5A. Translation Service (summarizer)
- [ ] Create `services/summarizer/src/services/translation.py`
- [ ] `translate_response(response, target_lang, llm_service)` — translate VIEResponse
- [ ] Extract translatable strings (skip code, URLs, numbers, emoji)
- [ ] Batch translate via LLM
- [ ] Inject translations back into response
- [ ] Graceful fallback: return original on failure

### 5B. Cache Integration
- [ ] Language-aware Redis cache key: `vie:response:{video_id}:{lang}`
- [ ] Check translated cache before calling LLM
- [ ] Store translated response in cache

### 5C. API Integration
- [ ] Add `?lang=he` query param to stream endpoint
- [ ] Post-process assembled response through translation before streaming
- [ ] Frontend: language picker in settings/header

---

## Session 6: Speaker Diarization — NOT STARTED (EXCLUDED)

### 6A. Diarization Service
- [ ] Create `services/summarizer/src/services/transcript/diarization.py`
- [ ] Install `pyannote-audio` (requires HF_TOKEN)
- [ ] `diarize(audio_path)` → list of `{ speaker, start, end }`
- [ ] `enrich_transcript_with_speakers(transcript, segments)` → labeled transcript
- [ ] Lazy-load pipeline (heavy model)
- [ ] Graceful fallback on failure

### 6B. Conditional Trigger
- [ ] `should_diarize(manifest)` — only when multiple speakers or narrative content
- [ ] Wire into stream.py pipeline after audio download, before transcript cleaning
- [ ] Add speaker info to manifest for triage context

### 6C. Tests
- [ ] Unit tests for segment grouping logic
- [ ] Unit tests for transcript enrichment
- [ ] Test graceful fallback when pyannote not installed

---

## Session 7: Category Prompt Variants ✅ DONE

### 7A. Detail Level Injection
- [x] Added `DETAIL LEVEL: {detail_level}` to `base_extraction.txt`
- [x] `get_detail_level(duration_seconds)` in prompt_builder.py — concise (<10min), standard (10-45min), detailed (>45min)
- [x] Wired into `_build_base_template()`, `build_extraction_prompt()`, `build_extraction_template()`
- [x] Wired into `extract()` in extractor.py

### 7B. Content Emphasis Injection
- [x] Added `CONTENT EMPHASIS: {content_emphasis}` to `base_extraction.txt`
- [x] `_EMPHASIS` dict with 8 domain-specific priority instructions
- [x] `get_content_emphasis(primary_tag)` in prompt_builder.py
- [x] Wired into extractor.py extraction call
- [x] All 30 prompt_builder tests pass
- [x] All 31 extractor tests pass

---

## Session 8: Component Interconnection + RecipePlayer — ✅ DONE

### Phase 1: Foundation (plumbing)

#### 1.1 TabStateContext
- [x] Create `apps/web/src/contexts/TabStateContext.tsx`
  - TabStateContextType interface (checkedItems, completedSteps, masteredCards, quizResults)
  - TabStateProvider component with videoId prop (resets on videoId change)
  - useTabState hook (throws if outside provider)
  - Actions: checkItem, uncheckItem, completeStep, uncompleteStep, masterCard, setQuizResult
  - Queries: isChecked, isStepCompleted, getCompletionPercent

#### 1.2 TabStateContext Tests
- [x] Create `apps/web/src/contexts/__tests__/tab-state-context.test.tsx`
  - Test: initial state is empty
  - Test: checkItem/uncheckItem toggle
  - Test: completeStep/uncompleteStep toggle
  - Test: masterCard adds to set
  - Test: setQuizResult adds to map
  - Test: isChecked/isStepCompleted query helpers
  - Test: getCompletionPercent calculation
  - Test: state resets on videoId change
  - Test: useTabState throws outside provider

#### 1.3 Mount TabStateProvider
- [x] Modify `apps/web/src/components/video-detail/OutputRouter.tsx`
  - Import TabStateProvider
  - Wrap content inside TabCoordinationProvider with TabStateProvider
  - Pass videoSummaryId as videoId prop

#### 1.4 Add currentTime to VideoPlayerContext
- [x] Modify `apps/web/src/contexts/VideoPlayerContext.tsx`
  - Add `currentTime: number` to VideoPlayerContextType
  - Poll `playerRef.current?.getCurrentTime()` on 1s interval when isPlayerOpen
  - Stop polling when !isPlayerOpen (clear interval)
  - Add to NOOP_CONTEXT (default 0)
  - Cleanup interval on unmount

#### 1.5 Pass currentTime to TimelineExplorer
- [x] Modify `apps/web/src/components/video-detail/output/ComposableOutput.tsx`
  - Read `currentTime` from useVideoPlayer()
  - Pass `currentTime` to TimelineExplorer in COMPONENT_REGISTRY timeline entry

---

### Phase 2: Checklist ↔ StepPlayer

#### 2.1 Checklist writes to TabStateContext
- [x] Modify `apps/web/src/components/video-detail/output/interactive/ChecklistInteractive.tsx`
  - Import useTabState (with try-catch fallback for outside-provider safety)
  - Add `tabId` prop (default to 'checklist')
  - On toggle: call checkItem/uncheckItem on TabStateContext (in addition to local state)
  - Keep local `checked: Set<number>` as source of truth for rendering
  - Sync local state → TabStateContext on toggle (dual-write)
  - Call markTabCompleted (from useTabCoordination) when all items checked

#### 2.2 Ingredient-Step Matcher
- [x] Create `apps/web/src/lib/ingredient-step-matcher.ts`
  - `getMatchTokens(ingredientName: string): string[]` — extract primary nouns
    - Strip qualifiers: fresh, large, small, dried, ground, minced, chopped, sliced, etc.
    - Return remaining words (lowercased)
  - `matchIngredientsToStep(stepInstruction: string, ingredients: Array<{label: string}>, checkedIndices: Set<number>): { total: number; checked: number; matchedIndices: number[] }`
    - For each ingredient, check if any match token appears in step instruction (case-insensitive word boundary)
    - Return count of matched ingredients that are checked
  - `buildStepIngredientMap(steps: StepItem[], ingredients: ChecklistItem[]): Map<number, number[]>`
    - Pre-compute mapping: stepIndex → ingredientIndices[]
    - Computed once, memoized by caller

- [x] Create `apps/web/src/lib/__tests__/ingredient-step-matcher.test.ts`
  - Test: "chicken breast" matches "Cut the chicken into chunks"
  - Test: "soy sauce" matches "Add soy sauce to the pan"
  - Test: "fresh garlic" matches "Mince the garlic" (strips "fresh")
  - Test: "olive oil" matches "heat olive oil"
  - Test: no false match between "salt" and "malt"
  - Test: buildStepIngredientMap returns correct mapping
  - Test: empty inputs return empty results

#### 2.3 StepPlayer reads checkedItems
- [x] Modify `apps/web/src/components/video-detail/output/interactive/StepByStepInteractive.tsx`
  - Import useTabState (with try-catch fallback)
  - Add `ingredients` prop (optional, for cross-tab readiness display)
  - Add `tabId` prop (default to 'steps')
  - Use `buildStepIngredientMap` to compute ingredient→step mapping (useMemo)
  - For each step, show readiness pill: "3/4 ingredients ready" when ingredients provided
  - Read `checkedItems` from TabStateContext to determine which ingredients are checked
  - Highlight steps where ALL ingredients are checked with subtle "Ready" badge

#### 2.4 Wire markTabCompleted
- [x] In ChecklistInteractive: call `markTabCompleted(tabId)` via useTabCoordination when allChecked
- [x] In StepByStepInteractive: call `markTabCompleted(tabId)` via useTabCoordination when allDone
- [x] Update COMPONENT_REGISTRY in ComposableOutput to pass `tabId={tab.id}` to checklist and step_player

---

### Phase 3: StepPlayer ↔ Timeline

#### 3.1 StepPlayer writes completedSteps
- [x] In StepByStepInteractive: on toggleComplete, also write to TabStateContext.completeStep/uncompleteStep

#### 3.2 Timeline reads completedSteps
- [x] Modify `apps/web/src/components/video-detail/output/interactive/TimelineExplorer.tsx`
  - Import useTabState (with try-catch fallback)
  - Read `completedSteps` from TabStateContext
  - For each timeline entry, match to nearest step by timestamp (within ±10s)
  - Show Check icon overlay on matched entries where step is completed
  - Show progress summary: "4/6 steps done" at top when any completedSteps exist

---

### Phase 4: FlashDeck ↔ Quiz

#### 4.1 FlashDeck writes masteredCards
- [x] Modify FlashDeckInteractive
  - Import useTabState (with try-catch fallback)
  - On markKnown: call `masterCard(String(currentCard))`
  - On markReview: (card already in reviewed, just not known — no TabState write needed)

#### 4.2 Quiz reads masteredCards
- [x] Modify QuizInteractive
  - Import useTabState (with try-catch fallback)
  - Read `masteredCards` from TabStateContext
  - For each question, check if related concept was mastered (match by normalizing question text ↔ card.front)
  - Show "📚 You studied this" Badge next to question when match found

#### 4.3 Quiz writes quizResults
- [x] In QuizInteractive: on handleSelect, call `setQuizResult(String(currentIndex), isCorrect)`

#### 4.4 FlashDeck reads quizResults
- [x] In FlashDeckInteractive: read `quizResults` from TabStateContext
  - For each card, check if related quiz question was answered incorrectly
  - Show "🔄 Review — missed in quiz" Badge when `quizResults.get(matchIndex) === false`
  - Match by normalizing card.front ↔ question text

---

### Phase 5: RecipePlayer

#### 5.1 RecipeIngredientPanel
- [x] Create `apps/web/src/components/video-detail/output/RecipeIngredientPanel.tsx`
  - Props: `items: ChecklistItem[], tabId: string, servings: number, baseServings: number, scalable: boolean`
  - Reuses ChecklistItem rendering from ChecklistInteractive
  - Reads/writes TabStateContext (shared with Checklist tab)
  - Progress bar at bottom
  - Compact layout for side panel

#### 5.2 RecipeStepView
- [x] Create `apps/web/src/components/video-detail/output/RecipeStepView.tsx`
  - Props: `steps: StepItem[], currentStep: number, onStepChange, onComplete, onSeek, ingredients?: ChecklistItem[]`
  - Shows one step at a time (large format for kitchen readability)
  - Timer with start/pause (uses existing Timer component with `autoStart={false}`)
  - "Watch this step" button → calls onSeek(step.timestamp)
  - Step thumbnail if available
  - Tips/safety notes expanded
  - Ingredient readiness per step (from ingredient-step-matcher)
  - Prev/Next navigation at bottom

#### 5.3 RecipePlayer orchestrator
- [x] Create `apps/web/src/components/video-detail/output/RecipePlayer.tsx`
  - Props: `ingredients, steps, tips?, onExit, onSeek`
  - Desktop: two-column (ingredients left 280px, step right flex-1)
  - Mobile: ingredients as collapsible top drawer
  - Header: "🍳 Cooking Mode" + "Exit" button
  - Stepper bar at bottom showing step progress
  - Coordinates currentStep state
  - Reads/writes TabStateContext (shared with tab views)

#### 5.4 Cooking mode detection + toggle
- [x] Modify ComposableOutput or OutputRouter
  - Detect cooking mode availability: primaryTag==="food" + has checklist + has step_player tabs
  - Add "🍳 Enter Cooking Mode" button (rendered above tabs when available)
  - cookingMode state (boolean)
  - When active: render RecipePlayer instead of normal tab content
  - "Exit Cooking Mode" returns to tabs with progress preserved (TabStateContext shared)

#### 5.5 Wire to contexts
- [x] RecipePlayer calls useVideoPlayer().seekTo for "Watch this step"
- [x] RecipePlayer reads/writes useTabState() for ingredient checks + step completions
- [x] RecipePlayer calls markTabCompleted when all steps done

#### 5.6 Responsive layout
- [x] Desktop (≥768px): side-by-side columns
- [x] Mobile (<768px): ingredients as collapsible drawer at top, step full width
- [x] All tap targets ≥ 44px
- [x] Timer controls: large buttons for kitchen use

---

### Phase 6: Polish + Testing

#### 6.1 Animations
- [x] Subtle transition when ingredient readiness pill updates
- [x] Fade transition when step badge changes from "not ready" to "ready"
- [x] Tab completed checkmark entrance animation (already exists in TabLayout)

#### 6.2 Accessibility
- [x] Keyboard navigation in RecipePlayer (arrow keys for steps)
- [x] ARIA labels on all interactive elements
- [x] Screen reader: announce step changes, ingredient readiness
- [x] prefers-reduced-motion: disable entrance animations

#### 6.3 Regression testing
- [x] Run existing unit tests: `cd apps/web && npm test`
- [x] Run existing E2E tests: verify domain-videos.spec.ts passes
- [x] Test non-food videos: no "Enter Cooking Mode" button, all tabs work independently
- [x] Test old cached videos: TabStateContext is empty but harmless (components fall back to local state)

#### 6.4 New tests
- [x] TabStateContext unit tests (Phase 1.2)
- [x] ingredient-step-matcher unit tests (Phase 2.2)
- [x] RecipePlayer component test (render, toggle cooking mode)
- [x] Integration: check ingredient in Checklist → StepPlayer shows readiness

---

## Summary

| Session | Status | Tests |
|---------|--------|-------|
| 1. SSE Consumer + Progressive Rendering | ✅ DONE | 34 unit tests |
| 2. E2E Testing (layout) | ✅ DONE | 66 Playwright tests |
| 2. E2E Testing (domain videos) | ✅ DONE | 56 Playwright tests |
| 3. Collections CRUD | ⬜ NOT STARTED | — |
| 4. Assistant Chat | ⬜ NOT STARTED | — |
| 5. Translation Layer | ⬜ NOT STARTED | — |
| 6. Speaker Diarization | ⬜ NOT STARTED | — |
| 7. Category Prompt Variants | ✅ DONE | 61 unit tests |
| 8. Component Interconnection + RecipePlayer | ✅ DONE | 33 unit + 9 e2e |
