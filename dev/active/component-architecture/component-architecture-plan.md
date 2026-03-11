# VIE Component Architecture — Final Reorganization Plan

**Last Updated: 2026-03-10**
**Status: Planning**
**Branch: dev-1**

---

## Executive Summary

Replace the current dual-system frontend (old OutputShell→OutputContent→output-views AND partially-implemented ComposableOutput→domain-renderers) with a clean 4-layer architecture:

```
Tab (from triage) → Interactive Component → Core Blocks → GlassCard → UI Primitives
```

**Scope**: ~50 components → ~40 components. Delete all legacy output code. Minor summarizer prompt tweaks. Fresh DB (no migration).

---

## Current State Analysis

### Two Parallel Systems Coexist

| System | Status | Components |
|--------|--------|------------|
| **Old** (OutputShell→OutputContent→output-views) | Active in production | 10 output-views (RecipeTabs, CodeTabs, etc.) |
| **New** (ComposableOutput→domain-renderers) | Implemented but dormant | 9 domain renderers (LearningRenderer, etc.) |

Both must be replaced by the interactive component architecture.

### Frontend Component Inventory (Current)

| Category | Count | Files |
|----------|-------|-------|
| Root components | 5 | OutputRouter, ContentBlockRenderer, ContentBlocks, InlineEditor, index |
| Core blocks | 27 | In blocks/ (includes 4 enrichment duplicates) |
| Block tests | 25 | In blocks/__tests__/ |
| Output infra | 12 | OutputShell, OutputHero, OutputContent, ComposableOutput, TabLayout, etc. |
| Domain renderers | 9 | In output/domain-renderers/ |
| Legacy output-views | 10 | In output/output-views/ (CodeTabs, RecipeTabs, etc.) |
| Enrichment (dupes) | 4 | In output/enrichment/ (FlashCard, ScenarioCard, ScoreRing, SpotCard) |
| Skeletons | 1 | OutputSkeleton.tsx |
| Output tests | 11 | In output/__tests__/ |
| **Total** | **~104 files** | |

### Summarizer State (Already Mostly Done)

- Triage prompt already has first-tab and label rules
- Enrichment already supports quiz + flashcards + scenarios (ScenarioItem model exists)
- enrich_code.txt already deleted
- Category mapping (CATEGORY_TO_TAG) already exists in triage.py
- Domain schemas in schemas/*.txt match Pydantic models

### Key Insight: Old Data Flow Still Active

```
API returns: VideoOutput { outputType, intent, output, synthesis, enrichment }
Stream events: intent_detected → extraction_complete → enrichment_complete → synthesis_complete
Frontend reads: StreamState → VideoOutput → OutputShell → OutputContent → output-views
```

The new system needs:
```
API returns: VideoOutput with triage field (already present but unused)
Stream events: triage_complete → extraction_complete → enrichment_complete → synthesis_complete
Frontend reads: StreamState → VIEResponse → ComposableOutput → Interactive Components
```

---

## Proposed Architecture

### Layer 1: Interactive Components (10) — Tab Controllers

| Component | Pattern | State | Blocks Used |
|-----------|---------|-------|-------------|
| ChecklistInteractive | Checkable list + progress | checked Set, progress % | ChecklistItem |
| QuizInteractive | Question progression + scoring | answers Map, score, currentIndex | QuizQuestion, ScoreRing |
| FlashDeckInteractive | Card deck + flip + nav | currentCard, flipped, reviewed | FlashCard |
| ScenarioInteractive | "Which X?" game + scoring | picks, score, currentIndex | ScenarioCard, ScoreRing |
| SpotExplorer | Expandable cards + sections | expanded Set | SpotCard, SectionSelector |
| StepByStepInteractive | Step progression + timers | currentStep, timerStates | StepBlock |
| ExerciseInteractive | Workout tracker + rest timer | completedSets, activeTimer | ExerciseCard, ScoreRing |
| TimelineExplorer | Filterable timestamps | activeMoodFilter, expanded | TimelineEntry |
| CodeExplorer | Code step-through | currentSnippet | CodeBlock |
| ComparisonInteractive | Toggle/swipe comparisons | activeComparison | ComparisonCard |

### Layer 2: Core Blocks (19) — Pure Display

CalloutBlock, ChecklistItem (new), CodeBlock, ComparisonCard (rename), DefinitionBlock, ExerciseCard (rename), FlashCard, KeyValueRow (rename), ListBlock, QuizQuestion (new), QuoteBlock (rename), ScenarioCard, ScoreRing, SpotCard, StatBlock (rename), StepBlock, TableBlock, TimelineEntry (rename+merge), VerdictBlock

### Layer 3: Output Infrastructure (11)

OutputRouter, ComposableOutput (rewrite), TabLayout, TabCoordinationContext, GlassCard, CrossTabLink, Celebration, SectionSelector, ProgressBar (new), DisplaySection (new), link-rules.ts, output-constants.ts

### Layer 4: UI Primitives (unchanged)

shadcn components — no changes needed.

---

## Implementation Phases

### Phase 0: Cleanup & Foundation (Effort: L)
Delete all legacy code. Establish new file structure. No new features.

### Phase 1: Core Blocks Refactor (Effort: L)
Rename, split, merge blocks from 27 → 19. Update all imports.

### Phase 2: Interactive Components (Effort: XL)
Build 10 interactive components. This is the main work.

### Phase 3: Output Infrastructure Rewrite (Effort: L)
Rewrite ComposableOutput to use TAB_INTERACTIVE_MAP. Add DisplaySection, ProgressBar.

### Phase 4: Data Flow Wiring (Effort: M)
Wire OutputRouter → ComposableOutput → Interactive Components. Update stream event processing.

### Phase 5: Summarizer Tweaks (Effort: S)
Minor prompt improvements. Verify Pydantic model alignment.

### Phase 6: Testing & Polish (Effort: L)
Update/rewrite tests. E2E validation. Fresh DB.

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking data flow during migration | High | Phase 0 moves legacy to legacy/ first, cut over in Phase 4 |
| ContentBlockRenderer still needed by MemorizedItemDetail/RAGChat | Medium | Keep ContentBlockRenderer untouched — it's orthogonal |
| Type mismatches between VIEResponse and interactive components | Medium | Define prop interfaces per interactive component in Phase 2 |
| Enrichment data (quiz/flashcards/scenarios) not reaching interactive components | High | Verify in Phase 4 with real stream data |
| Old DB data incompatible | None | Fresh DB — no migration concern |

---

## Success Metrics

1. All 9 domain renderers deleted (not in legacy/, fully gone)
2. All 10 output-views deleted
3. OutputShell, OutputHero, OutputContent deleted
4. 10 interactive components working with real data
5. 19 core blocks, each under 200 lines
6. All existing tests pass or are replaced
7. E2E tests pass with fresh summarized content
8. No TypeScript errors in video-detail/

---

## Dependencies

- **packages/types** must be rebuilt after output-types.ts changes
- **api/src/routes/stream.routes.ts** may need SSE event name updates
- **api/src/services/video.service.ts** may need response shape updates
- **services/summarizer** prompt tweaks are independent of frontend work
- **MongoDB** — drop all collections except users, recreate admin user
