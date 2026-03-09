# Per-Chapter Views + Inline Concept Tooltips

**Last Updated**: 2026-02-10
**Status**: COMPLETE — All phases implemented and tested
**Effort**: Large (L) - completed in single session
**Branch**: `dev-0` (uncommitted changes)

---

## Executive Summary

The summarizer currently assigns one global category per video, forcing ALL chapters to render with the same view. A Mexican food vlog categorized as "reviews" renders cooking chapters with `rating` blocks instead of `ingredient`/`step` blocks. This plan introduces per-chapter view detection via a dual-persona LLM architecture and inline concept tooltips that surface definitions where concepts are mentioned, not just in a sidebar.

**Two independent improvements:**
1. **Per-chapter views** (Phases A+B): Each chapter independently selects the best frontend view based on its content
2. **Inline concept tooltips** (Phase C): Concept definitions appear as interactive popovers within content text

---

## Current State Analysis

### Per-Chapter View Problem

| Component | Current Behavior | Problem |
|-----------|-----------------|---------|
| `youtube.py` | Detects ONE global category per video | Mixed-content videos get wrong category for some chapters |
| `llm.py` | Receives `persona` parameter per chapter call | All chapters get the SAME persona from global category |
| `stream.py` | Passes global `persona` to every `summarize_chapter()` call | No per-chapter differentiation |
| `chapter_summary.txt` | Injects `{persona_guidelines}` + `{variant_examples}` | Persona-specific but same for all chapters |
| `ArticleSection.tsx` | Uses global `category` prop for view switch | All chapters render in same view |

**Current persona files** (8 files in `prompts/personas/`):
- `code.txt`, `recipe.txt`, `interview.txt`, `review.txt`, `standard.txt`, `fitness.txt`, `travel.txt`, `education.txt`
- Each ~10-20 lines of thin guidance ("You are a friendly chef")

**Current example files** (8 files in `prompts/examples/`):
- Same names as personas, each with JSON output examples
- These are valuable for output quality and MUST be preserved

### Concept Tooltip Problem

| Component | Current Behavior | Problem |
|-----------|-----------------|---------|
| `ArticleSection.tsx` | Shows concepts in sidebar with expand/collapse | User must scroll to sidebar to see what "Penca de Maguey" means |
| Content blocks | Render raw text strings | No awareness of concepts in the text |

### Naming Mismatch (Old Persona vs New View)

| Old Persona Name | New View Name | Frontend Category |
|-----------------|---------------|-------------------|
| `recipe` | `cooking` | `cooking` |
| `code` | `coding` | `coding` |
| `review` | `reviews` | `reviews` |
| `interview` | `podcast` | `podcast` |
| `standard` | `standard` | `standard` |
| `travel` | `travel` | `travel` |
| `fitness` | `fitness` | `fitness` |
| `education` | `education` | `education` |
| *(new)* | `diy` | `diy` |
| *(new)* | `gaming` | `gaming` |

---

## Proposed Future State

### Architecture: Dual-Persona System

```
Before:
  Global Category → One Persona → All Chapters Same View

After:
  Global Category → Hint for examples
  Per Chapter → LLM selects Expert → Outputs view + content blocks
                                   → Soft block-inference correction
```

**Author + Domain Expert model**: The LLM always writes as a consistent Author voice, but consults a domain-specific Expert for each chapter. 10 experts cover all `VideoCategory` values.

### View Resolution (Soft Correction)

```
1. LLM states view → PRIMARY signal
2. Block inference checks for 2+ signature blocks → CORRECTION only
3. If no strong block match → trust LLM view
4. If LLM gave no/invalid view → fall back to "standard"
```

### Concept Tooltips Architecture

```
ArticleSection
  └── ConceptsProvider (React Context with concepts array)
       └── CategoryView (CodeView, RecipeView, etc.)
            └── ContentBlockRenderer
                 └── ParagraphBlock
                      └── ConceptHighlighter (regex match → Popover)
                 └── CalloutBlock
                      └── ConceptHighlighter
                 └── QuoteRenderer
                      └── ConceptHighlighter
```

---

## Implementation Phases

### Phase A: Backend Per-Chapter View (Independent)

**Goal**: LLM independently selects view per chapter. Block inference provides safety net.

**Files modified:**
- `services/summarizer/src/prompts/persona_system.txt` — **NEW**
- `services/summarizer/src/prompts/chapter_summary.txt` — modify
- `services/summarizer/src/services/llm.py` — modify (3 methods + new function)
- `services/summarizer/src/routes/stream.py` — modify (4 functions)

**Token cost**: +500-650 tokens per chapter (persona_system replaces persona_guidelines but keeps variant_examples)

### Phase B: Types + Frontend Per-Chapter View (After A)

**Goal**: Frontend uses per-chapter view when available, falls back to global category.

**Files modified:**
- `packages/types/src/index.ts` — add `view` field
- `apps/web/src/components/video-detail/ArticleSection.tsx` — one-line change

### Phase C: Inline Concept Tooltips (Independent of A/B)

**Goal**: Concept definitions appear as inline popovers in text content.

**Files created:**
- `apps/web/src/components/video-detail/ConceptsContext.tsx` — **NEW**
- `apps/web/src/components/video-detail/ConceptHighlighter.tsx` — **NEW**

**Files modified:**
- `apps/web/src/components/video-detail/ArticleSection.tsx` — wrap with ConceptsProvider
- `apps/web/src/components/video-detail/ContentBlockRenderer.tsx` — paragraph integration
- `apps/web/src/components/video-detail/blocks/CalloutBlock.tsx` — text integration
- `apps/web/src/components/video-detail/blocks/QuoteRenderer.tsx` — text integration
- `apps/web/src/components/video-detail/blocks/DefinitionBlock.tsx` — meaning integration

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| LLM picks wrong expert for a chapter | Medium | Low | Soft block-inference correction catches egregious mismatches; log warnings for prompt tuning |
| Quality regression from removing per-persona guidelines | Medium | High | Keep `{variant_examples}` — only replace `{persona_guidelines}` with `{persona_system}` |
| Regex performance with many concepts | Low | Medium | `useMemo` keyed on concept list; regex compiled once per video |
| `\b` word boundary fails on accented names | High | Medium | Use lookahead/lookbehind for whitespace/punctuation instead |
| DIY/cooking `step` block overlap in inference | Low | Low | Soft correction requires 2+ blocks; ties defer to LLM |
| Popover congestion with adjacent concepts | Medium | Medium | Track `openConceptId` — one popover at a time |
| Old cached summaries missing `view` field | None | None | `view` is optional; falls back to global `category` |

---

## Success Metrics

1. **Re-summarize Mexican food video**: cooking chapters get `cooking` view, review chapters get `reviews` view
2. **View mismatch logs**: <10% of chapters trigger correction warnings
3. **Concept tooltips**: clicking a concept name in paragraph text shows definition popover
4. **Backward compat**: old summaries render unchanged
5. **Mobile**: popovers work on touch, don't overflow viewport
6. **No regressions**: existing tests pass

---

## Dependencies

| Dependency | Status | Notes |
|-----------|--------|-------|
| `VideoCategory` type with all 10 values | Done | Already in `packages/types/src/index.ts` |
| All 10 frontend views (including DIY, Gaming) | Done | Already in `ArticleSection.tsx` |
| 8 persona files + 8 example files | Done | Keep existing; add comment for missing DIY/Gaming |
| Radix Popover | Done | `@radix-ui/react-popover` confirmed in `apps/web/package.json` |
| Content block components (32 blocks) | Done | All exist in `blocks/` directory |

---

## Timeline Estimate

| Phase | Effort | Dependencies | Estimated Duration |
|-------|--------|-------------|-------------------|
| A: Backend per-chapter view | L | None | 1.5-2 days |
| B: Types + frontend view | S | Phase A | 0.5 day |
| C: Concept tooltips | M | None (parallel with A) | 1.5-2 days |
| Verification & testing | M | A + B + C | 0.5-1 day |
| **Total** | | | **4-5.5 days** |
