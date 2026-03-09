# Unified Output System — Kill V1, Simplify Blocks, Build ExplanationView

**Last Updated: 2026-03-05**
**Status**: COMPLETE (Phases 1-5, 7-8 done; Phase 6 deferred)
**Effort**: XL (10-15 developer-days)
**Branch**: `dev-1` (current)

---

## Executive Summary

The app has a tangled V1/V2 dual system: `OutputRouter` branches between `VideoDetailLayout` (V1) and `OutputShellV2` (V2), `StreamState` carries both V1 and V2 fields, types have `VideoOutputV1 | VideoOutputV2` unions, and 35 content blocks have significant overlap. This plan executes a clean break: one system, simplified blocks (~20), an interactive ExplanationView as default output, ChaptersView with flip cards, and multi-output groundwork.

**Scope**: ~50+ file deletions, ~15 file modifications, ~5 new files, type system overhaul, backend prompt cleanup.

---

## Current State Analysis

### Dual System Problem

| Layer | V1 | V2 | Issue |
|-------|----|----|-------|
| **Types** | `OutputType` (11 values) in `index.ts` | `OutputTypeV2` (10 values) in `output-types.ts` | Two parallel enums |
| **Output Models** | `VideoOutputV1` | `VideoOutputV2` | Discriminated union forces branching everywhere |
| **Views** | 10 category views (`StandardView`, `RecipeView`, etc.) | 10 output tabs (`SmartSummaryTabs`, `RecipeTabs`, etc.) | Duplicate rendering logic |
| **Layout** | `VideoDetailLayout` + Desktop/Mobile | `OutputShell` | Two layout systems |
| **Routing** | `OutputRouter` branches on `pipelineVersion` | Direct `OutputShell` render | Unnecessary branching |
| **Streaming** | 10+ V1 SSE events (`chapters`, `chapter_ready`, etc.) | 6 V2 events (`intent_detected`, etc.) | `StreamState` carries both |
| **Hooks** | 7 V1 hooks (auto-flow, block-groups, chapter-playback) | `use-output-state.ts` | V1 hooks unused by V2 |
| **Lib** | `auto-flow-layout.ts`, `block-layout.ts`, `content-weight.ts` | `stream-event-processor.ts` handles both | Dead V1 layout code |
| **Blocks** | 35 block components | Shared (same blocks) | 15 blocks could merge into ~6 |
| **Prompts** | `chapter_detect.txt`, `chapter_summary.txt`, `master_summary.txt` | `intent_detect.txt`, `extract_*.txt`, `synthesis_v2.txt` | V1 prompts unused |

### Key Metrics

- **V1 files to delete**: ~50 (views, containers, layout, hooks, libs)
- **Blocks to merge**: 15 blocks -> 6 consolidated blocks
- **Blocks to keep**: ~14 blocks as-is
- **Net block count**: 35 -> ~20
- **Python prompts to delete**: 8 (chapter_detect, chapter_summary, chapter_facts, chapter_validate, master_summary, metadata_tldr, synthesis_v2, quick_synthesis)
- **Python prompts to merge**: `global_synthesis.txt` + `quick_synthesis.txt` -> `synthesis.txt`

---

## Proposed Future State

```
packages/types/src/
  output-types.ts          # OutputType (was V2), VideoOutput (was V2), no V1 artifacts
  index.ts                 # Clean - no V1 types, updated ContentBlock union

apps/web/src/components/video-detail/
  output/                  # Flattened from v2/ (THE system)
    OutputShell.tsx         # Was OutputShellV2
    OutputContent.tsx
    OutputHero.tsx
    GlassCard.tsx
    TabLayout.tsx
    output-views/
      ExplanationTabs.tsx   # Was SmartSummaryTabs (rewritten)
      RecipeTabs.tsx
      ... (10 total)
      ChaptersView.tsx      # NEW - flip card chapter display
  blocks/                  # ~20 consolidated blocks
    ListBlock.tsx           # Merges BulletsBlock + NumberedBlock
    ComparisonBlock.tsx     # Merges ComparisonRenderer + DosDontsBlock + ProConBlock
    CodeBlock.tsx           # Merges CodeBlock + ExampleBlock + TerminalBlock
    CalloutBlock.tsx        # Merges CalloutBlock + QuoteRenderer
    DataListBlock.tsx       # Merges DefinitionBlock + KeyValueRenderer + NutritionBlock + IngredientBlock
    StepsBlock.tsx          # Merges StepBlock + TimelineBlock
    ... (14 kept as-is)
  ContentBlockRenderer.tsx  # Reduced from ~35 to ~25 switch cases

apps/web/src/hooks/
  use-summary-stream.ts    # Cleaned: no V1 fields, v2* renamed
  # Deleted: use-active-chapter, use-chapter-playback, use-auto-flow-layout,
  #          use-block-groups, use-block-measurements, use-block-props, use-grouped-blocks

apps/web/src/lib/
  stream-event-processor.ts # No V1 handlers
  # Deleted: auto-flow-layout, block-layout, content-weight, concept-utils,
  #          layout-constants, timestamp-utils, block-labels, block-schemas

services/summarizer/src/
  models/output_types.py    # OutputType (renamed), smart_summary -> explanation
  prompts/
    synthesis.txt           # Merged from global + quick
    # Deleted: chapter_detect, chapter_summary, chapter_facts, chapter_validate,
    #          master_summary, metadata_tldr, synthesis_v2
```

---

## Implementation Phases

### Phase 1: Type System Unification (Foundation)

**Effort**: M (1-2 days)
**Risk**: Medium (everything depends on types compiling)

All subsequent phases depend on this. Changes to shared `@vie/types` package ripple to all consumers.

**Files Modified**:
- `packages/types/src/output-types.ts` — rename V2 types to be canonical, delete V1 compat
- `packages/types/src/index.ts` — remove V1 `OutputType`, `VideoCategory`, `VideoSummary`, `SummaryChapter`, `Concept`, V1 SSE events, `SummaryStreamPhase`

**Acceptance Criteria**:
- `OutputTypeV2` renamed to `OutputType`, `smart_summary` renamed to `explanation`
- `VideoOutputV2` renamed to `VideoOutput`, no `pipelineVersion` field
- `PipelineVersion`, `VideoOutputV1`, `OUTPUT_TYPE_V1_TO_V2`, `isV1Output`, `isV2Output` deleted
- `isOutputTypeV2` renamed to `isValidOutputType`
- `SmartSummaryOutput` renamed to `ExplanationOutput`
- V1 `OutputType`, `VideoCategory`, `CATEGORY_TO_OUTPUT_TYPE`, `VALID_OUTPUT_TYPES` removed from index.ts
- V1 summary interfaces (`VideoSummary`, `SummaryChapter`, `Concept`) removed
- V1 SSE event types removed
- `ContentBlock` union updated for consolidated blocks (Phase 2 types)
- `npx tsc --noEmit` passes in packages/types

---

### Phase 2: Block Consolidation (35 -> ~20)

**Effort**: L (2-3 days)
**Risk**: Medium (rendering regressions possible)
**Depends on**: Phase 1 (ContentBlock type changes)

**Merge Map**:

| New Block | Merges | Key Props |
|-----------|--------|-----------|
| `ListBlock` | `BulletsBlock` + `NumberedBlock` | `ordered` prop, `variant: 'checklist' \| 'ingredients'` |
| `ComparisonBlock` | `ComparisonRenderer` + `DosDontsBlock` + `ProConBlock` | `variant: 'dos_donts' \| 'pros_cons' \| 'versus' \| 'before_after'` |
| `CodeBlock` | `CodeBlock` + `ExampleBlock` + `TerminalBlock` | `mode: 'code' \| 'example' \| 'terminal'` |
| `CalloutBlock` | `CalloutBlock` + `QuoteRenderer` | `variant: 'tip' \| 'warning' \| 'note' \| 'quote'` |
| `DataListBlock` | `DefinitionBlock` + `KeyValueRenderer` + `NutritionBlock` + `IngredientBlock` | `variant: 'definition' \| 'specs' \| 'nutrition' \| 'ingredients'` |
| `StepsBlock` | `StepBlock` + `TimelineBlock` | `variant: 'steps' \| 'timeline'` |

**Files Deleted** (12):
`BulletsBlock.tsx`, `NumberedBlock.tsx`, `DosDontsBlock.tsx`, `ProConBlock.tsx`, `ExampleBlock.tsx`, `TerminalBlock.tsx`, `QuoteRenderer.tsx`, `DefinitionBlock.tsx`, `KeyValueRenderer.tsx`, `NutritionBlock.tsx`, `IngredientBlock.tsx`, `StepBlock.tsx`, `TimelineBlock.tsx`

**Files Modified**:
- `ContentBlockRenderer.tsx` — reduce switch cases, map old type names to new blocks
- Each new consolidated block — combine rendering logic from merged blocks

**Blocks Kept As-Is** (~14):
`ParagraphBlock`, `TableBlock`, `RatingBlock`, `VerdictBlock`, `ExerciseBlock`, `WorkoutTimerBlock`, `QuizBlock`, `FormulaBlock`, `GuestBlock`, `FileTreeBlock`, `LocationBlock`, `ItineraryBlock`, `CostBlock`, `VisualBlock`, `TranscriptBlock`, `ProblemSolutionBlock`, `ToolListBlock`, `StatisticRenderer`, `TimestampRenderer`, `BlockWrapper`

**Acceptance Criteria**:
- 6 new consolidated blocks render all variants correctly
- `ContentBlockRenderer` switch cases reduced from ~35 to ~25
- Old block type names still work (mapped to new components)
- All existing block tests pass or updated
- No visual regressions in V2 output views
- Block test files updated for merged blocks

---

### Phase 3: V1 Deletion (~50 files)

**Effort**: L (2-3 days)
**Risk**: High (largest file count change, import breakage)
**Depends on**: Phase 1 (types), Phase 2 (blocks don't reference V1)

#### 3a: Delete V1 Views (12 files)
`apps/web/src/components/video-detail/views/` — entire directory:
`StandardView`, `RecipeView`, `CodeView`, `EducationView`, `FitnessView`, `TravelView`, `ReviewView`, `PodcastView`, `GamingView`, `DIYView`, `ViewLayout`, `SectionHeader`, `index.ts`

#### 3b: Delete V1 Layout Components (~20 files)
From `apps/web/src/components/video-detail/`:
- `VideoDetailLayout.tsx`, `VideoDetailDesktop.tsx`, `VideoDetailMobile.tsx`
- `ArticleSection.tsx`, `ChapterCard.tsx`, `ChapterList.tsx`
- `ChapterNavItem.tsx`, `StickyChapterNav.tsx`, `MobileChapterNav.tsx`
- `CollapsibleVideoPlayer.tsx`, `ConceptsGrid.tsx`, `ConceptHighlighter.tsx`, `ConceptsContext.tsx`, `OrphanedConcepts.tsx`
- `FlowRowRenderer.tsx`, `ContentBlocks.tsx`
- `RightPanelTabs.tsx`, `MasterSummaryModal.tsx`, `DetectionOverride.tsx`
- `GoDeepDrawer.tsx`, `VideoSummaryIdContext.tsx`

#### 3c: Delete V1 Containers (5 files)
`apps/web/src/components/video-detail/containers/` — entire directory

#### 3d: Delete V1 Hooks (7 files)
- `use-active-chapter.ts`, `use-chapter-playback.ts`, `use-auto-flow-layout.ts`
- `use-block-groups.ts`, `use-block-measurements.ts`, `use-block-props.ts`, `use-grouped-blocks.ts`

#### 3e: Delete V1 Libs (8 files)
- `auto-flow-layout.ts`, `block-layout.ts`, `block-labels.ts`, `block-schemas.ts`
- `content-weight.ts`, `concept-utils.ts`, `layout-constants.ts`, `timestamp-utils.ts`

#### 3f: Evaluate & Keep
- `VideoHero.tsx` — evaluate if `OutputHero.tsx` replaces it; delete if redundant
- `VideoTags.tsx` — keep if still referenced
- `ResourcesPanel.tsx`, `VideoChatPanel.tsx` — keep, adapt imports
- `use-output-state.ts`, `use-markdown-export.ts`, `block-to-markdown.ts` — keep, adapt
- `InlineEditor.tsx` — keep if used by V2

**Acceptance Criteria**:
- All listed V1 files deleted
- No remaining imports reference deleted files
- `npx tsc --noEmit` passes
- Existing V2 output views still render correctly
- Associated test files for deleted components also removed

---

### Phase 4: Rename V2 -> The System

**Effort**: M (1-2 days)
**Risk**: Low-Medium (mostly renames and moves)
**Depends on**: Phase 3 (V1 gone, no confusion)

#### 4a: File Moves
- Move `apps/web/src/components/video-detail/v2/*` -> `apps/web/src/components/video-detail/output/`
- `OutputShellV2` -> `OutputShell` (rename export + component name)
- `OutputRouter.tsx` -> simplify to just render `OutputShell` directly, or remove and use `OutputShell` in `VideoDetailPage`

#### 4b: Streaming Cleanup (`use-summary-stream.ts`)
Remove V1 `StreamPhase` values: `parallel_analysis`, `chapter_detect`, `chapter_summaries`, `concepts`, `master_summary`

Remove V1 `StreamState` fields: `chapters`, `currentChapterIndex`, `currentChapterText`, `concepts`, `masterSummary`, `detectedChapters`, `isCreatorChapters`, `descriptionAnalysis`, `chapterStatuses`, `detectionResult`

Rename: `v2Intent` -> `intent`, `v2Output` -> `output`, `v2Synthesis` -> `synthesis`, `v2Enrichment` -> `enrichment`, `v2ExtractionProgress` -> `extractionProgress`

#### 4c: Stream Event Processor Cleanup (`stream-event-processor.ts`)
Remove V1 handlers: `chapters`, `description_analysis`, `transcript_ready`, `token`, `sections_detected`, `chapters_detected`, `chapter_start`, `chapter_complete`, `chapter_ready`, `concepts_complete`, `master_summary_complete`, `detection_result`

#### 4d: VideoDetailPage Simplification
- Remove `buildSummaryFromStream()` function
- Remove `summary` memo, `cachedSummary` extraction
- Remove V1 props from OutputShell call
- `v2Output` memo becomes the only `output` memo

**Acceptance Criteria**:
- No `v2` prefix in any variable/file name
- `v2/` directory no longer exists
- `OutputRouter` either removed or simplified to just `OutputShell`
- `StreamState` has no V1 fields
- Stream event processor has no V1 handlers
- All imports updated
- `npx tsc --noEmit` passes

---

### Phase 5: ExplanationView (Core New UX)

**Effort**: M (2-3 days)
**Risk**: Medium (new interactive UI, needs visual QA)
**Depends on**: Phase 4 (naming settled)

**File**: `SmartSummaryTabs.tsx` -> rewrite as `ExplanationTabs.tsx`

Current SmartSummaryTabs is 86 LOC with flat lists in tab panels. The new ExplanationView:

1. **Key Points tab**: Expandable cards (tap to reveal detail), timestamp badges that jump to video position
2. **Concepts tab**: Tap-to-expand definition cards in responsive grid (reuse StudyTabs pattern)
3. **Takeaways tab**: Action-oriented cards with checkbox UX
4. **Timestamps tab**: Persistent timeline with jump-to-point

**Type Changes**:
- `SmartSummaryOutput` already renamed to `ExplanationOutput` in Phase 1
- Add `actionItems?: string[]` field to `ExplanationOutput`

**Acceptance Criteria**:
- ExplanationTabs renders with 4 tabs
- Key Points cards expand/collapse with smooth animation
- Timestamp badges clickable and jump to video position
- Concepts grid matches StudyTabs pattern
- Takeaways have checkbox UX
- Mobile (375px) responsive, no overflow
- Tablet (768px) responsive
- Desktop full layout works

---

### Phase 6: ChaptersView (New Feature)

**Effort**: M (1-2 days)
**Risk**: Low (additive, doesn't break existing)
**Depends on**: Phase 4 (output directory structure)

**New file**: `apps/web/src/components/video-detail/output/output-views/ChaptersView.tsx`

Card-based chapter display with flip animations:
- **Front**: emoji + title + timestamp badge + 1-line summary
- **Back**: full content using consolidated `ContentBlockRenderer`
- **Grid**: 1 col mobile, 2 cols tablet, 3 cols desktop
- **Animation**: CSS `perspective` + `rotateY` + `backface-visibility: hidden`
- Based on `GlassCard` component with `interactive` variant

**Acceptance Criteria**:
- Cards flip on click with smooth animation
- Front shows emoji, title, timestamp, summary
- Back renders full content blocks
- Responsive grid (1/2/3 columns)
- Can appear as tab in any output type with chapter-like data
- Works in both light and dark mode

---

### Phase 7: Multi-Output Groundwork

**Effort**: S (0.5-1 day)
**Risk**: Low (type extension only, no behavior change)
**Depends on**: Phase 4

Extend `VideoOutput` to support sections:
```typescript
interface VideoOutput {
  primaryType: OutputType;
  intent: IntentResult;
  sections: OutputSection[];  // 1+ sections
  synthesis: SynthesisResult;
}
```

`OutputShell` already uses `TabLayout` with sections from `intent.sections`. Multi-output means top-level tabs represent different output types. Backend prompt changes deferred.

**Acceptance Criteria**:
- `VideoOutput` type updated with `sections` array
- Existing single-output videos still work (1 section)
- No runtime behavior changes

---

### Phase 8: Backend Prompt Consolidation

**Effort**: M (1-2 days)
**Risk**: Low (independent of frontend)
**Can run in parallel with**: Phases 5-7

#### 8a: Prompt Cleanup
**Keep** (battle-tested): `accuracy_rules.txt`, `persona_system.txt`, `concept_extract.txt`, `intent_detect.txt`, all `extract_*.txt` (10), all `personas/*.txt` (9), all `examples/*.txt` (8), `enrich_code.txt`, `enrich_study.txt`, `description_analysis.txt`

**Merge**: `global_synthesis.txt` + `quick_synthesis.txt` -> unified `synthesis.txt`

**Delete** (8 files): `synthesis_v2.txt`, `chapter_summary.txt`, `chapter_detect.txt`, `chapter_facts.txt`, `chapter_validate.txt`, `master_summary.txt`, `metadata_tldr.txt`

#### 8b: Python Models
- `output_types.py`: rename `OutputTypeV2` -> `OutputType`, rename `smart_summary` -> `explanation`
- Update `OUTPUT_TYPE_MODELS` registry
- Update V1->V2 mapping dict (or remove it entirely)

#### 8c: Python Service References
- Update any service files that reference old type names
- `services/summarizer/src/services/extractor.py`, `intent_detector.py`, `synthesis_v2.py`, `enrichment.py`

**Acceptance Criteria**:
- 8 V1 prompt files deleted
- `synthesis.txt` created from merge of global + quick
- Python `OutputType` enum has `explanation` instead of `smart_summary`
- No references to `OutputTypeV2` in Python code
- Summarizer still processes videos correctly (manual test)

---

## Execution Order

```
Phase 1 (Types) ──┬──> Phase 2 (Blocks) ──> Phase 3 (V1 Delete) ──> Phase 4 (Rename V2)
                   │                                                        │
                   │                                                        ├──> Phase 5 (ExplanationView)
                   │                                                        ├──> Phase 6 (ChaptersView)
                   │                                                        └──> Phase 7 (Multi-Output)
                   │
                   └──> Phase 8 (Backend Prompts) [parallel, independent]
```

**Recommended order**: 1 -> 3 -> 2 -> 4 -> 5 -> 6 -> 7 (with 8 anytime)

Rationale: Delete V1 (Phase 3) before consolidating blocks (Phase 2) to reduce noise. But Phase 1 (types) must be first since everything depends on it.

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Type rename breaks downstream consumers | High | High | Run `tsc --noEmit` after Phase 1, fix all errors before proceeding |
| Block consolidation causes visual regressions | Medium | Medium | Screenshot comparison of all block types before/after |
| V1 deletion misses a still-referenced file | Medium | High | `grep -r` for all deleted file names after deletion |
| Streaming cleanup breaks SSE processing | Medium | High | Test with live video processing after Phase 4 |
| ExplanationView UX doesn't match expectations | Low | Medium | Iterate on design with user feedback |
| Multi-output type changes break serialization | Low | Medium | Keep backward-compatible, add fields don't remove |

---

## Success Metrics

- [ ] Zero `V1`, `V2`, `v2` prefixes in codebase (except git history)
- [ ] Block count reduced from 35 to ~20
- [ ] `StreamState` has no V1 fields
- [ ] `OutputRouter` removed or trivial
- [ ] `views/` directory (V1) deleted
- [ ] `containers/` directory deleted
- [ ] V1 hooks and libs deleted
- [ ] ExplanationView renders with 4 interactive tabs
- [ ] ChaptersView renders with flip card animation
- [ ] `npx tsc --noEmit` passes in all packages
- [ ] All remaining tests pass
- [ ] No V1 SSE event handlers in stream processor

---

## Verification

After each phase, run:
```bash
cd apps/web && npx tsc --noEmit     # Type check
cd apps/web && npm test              # Unit tests
cd apps/web && npx playwright test   # E2E tests
```

After Phase 5 (ExplanationView), manually verify:
- Navigate to a completed video -> see ExplanationView with interactive cards
- Tab switching works, timestamps jump to video position
- Mobile (375px) and tablet (768px) responsive, no overflow

After Phase 6 (ChaptersView), manually verify:
- Chapters tab appears, cards flip on click, content renders on back
