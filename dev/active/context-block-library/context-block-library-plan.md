# Context Block Library V2.1 — Implementation Plan

**Last Updated:** 2026-02-04
**Status:** Ready for Implementation
**Effort:** XL (6-8 developer-weeks)

---

## Executive Summary

Build a composable, atomic block system for displaying YouTube video summaries across all video categories. This involves:

1. **Terminology alignment**: Section → Chapter (aligns with video terminology)
2. **Block ID stability**: All blocks have stable `blockId: string` for tracking
3. **Category theming**: CSS variables for category-based styling (cooking, coding, travel, etc.)
4. **22 new blocks**: Universal (5) + Category-specific (17)
5. **7 new category views**: Travel, Review, Fitness, Education, Podcast, DIY, Gaming
6. **Consistent rendering**: Same blocks render in summary, memorized items, and RAG chat

---

## Current State Analysis

### What Exists (✅ Done)

| Component | Status | Notes |
|-----------|--------|-------|
| **9 Block Renderers** | ✅ Complete | BulletsBlock, NumberedBlock, ExampleBlock, CalloutBlock, KeyValueRenderer, ComparisonRenderer, TimestampRenderer, QuoteRenderer, StatisticRenderer |
| **ContentBlockRenderer** | ✅ Complete | Switch router, type-safe, exhaustive checking |
| **3 Views** | ✅ Complete | StandardView, CodeView, RecipeView |
| **Types (@vie/types)** | ✅ Complete | 12 content block types, Section, VideoSummary |
| **CSS System** | ✅ Complete | Tailwind v4, CSS variables, dark/light mode |
| **ArticleSection** | ✅ Complete | Persona-based view selection, inline video |

### Terminology Gap Analysis

| Spec Term | Current Codebase Term | Action |
|-----------|----------------------|--------|
| Chapter | Section | Rename types + components |
| ChapterSection | ArticleSection | Rename component |
| blockId | Not present | Add to all block types |
| category | persona | Rename in VideoContext |
| MemorizedItem | Not present | Add type to @vie/types |

### Block Gap Analysis

**New Universal Blocks (5):**
- TranscriptBlock (timestamped transcript)
- DosDontsBlock (two-column do/don't) — partially exists as do_dont inline
- TimelineBlock (chronological events)
- DefinitionBlock (term accordion) — partially exists inline
- ToolListBlock (equipment list)

**New Category-Specific Blocks (17):**

| Category | Blocks | Count |
|----------|--------|-------|
| Cooking | IngredientBlock, StepBlock, NutritionBlock | 3 |
| Coding | CodeBlock, TerminalBlock, FileTreeBlock | 3 |
| Travel | LocationBlock, ItineraryBlock, CostBlock | 3 |
| Reviews | ProConBlock, RatingBlock, VerdictBlock | 3 |
| Fitness | ExerciseBlock, WorkoutTimerBlock | 2 |
| Education | QuizBlock, FormulaBlock | 2 |
| Podcast | GuestBlock | 1 |

### View Gap Analysis

**Existing Views (3):** StandardView, CodeView, RecipeView

**New Views Needed (7):**
- TravelView
- ReviewView
- FitnessView
- EducationView
- PodcastView
- DIYView
- GamingView

---

## Proposed Future State

### Architecture Hierarchy

```
VideoSummary
  └── chapters: Chapter[]          (renamed from sections)
       └── blocks: ContentBlock[]   (each has blockId)

MemorizedItem
  └── chapters: Chapter[]           (copied from video)
       └── blocks: ContentBlock[]
  └── videoContext.category         (for styling)

ContentBlock
  └── blockId: string               (stable UUID)
  └── type: ContentBlockType
  └── variant?: string
```

### CSS Theming System

```css
.category-{name} {
  --category-accent: color;
  --category-accent-soft: rgba(...);
  --category-surface: color;
}
```

### Rendering Consistency

Same `ContentBlockRenderer` used in:
1. Video Summary pages
2. Memorized Item detail views
3. RAG Chat output messages

---

## Implementation Phases

### Phase 0: Foundation (3-4 days)
**Goal:** Align terminology, add blockId, set up category theming

1. Rename Section → Chapter in @vie/types
2. Add blockId to all ContentBlock types
3. Rename ArticleSection → ChapterSection
4. Update VideoContext: persona → category
5. Add category CSS variables to index.css
6. Create BlockWrapper component for a11y
7. Add MemorizedItem type to @vie/types
8. Update VideoDetailLayout with category routing

### Phase 1: Universal Block Expansion (1 week)
**Goal:** Build 5 new universal blocks + 4 new primitives

**Primitives:**
1. Timer (cooking/workout timers)
2. CopyButton (code copy functionality)
3. ProgressRing (circular progress)
4. ExpandableText (show more/less)

**Universal Blocks:**
1. TranscriptBlock (timestamped lines)
2. DosDontsBlock (extract from inline rendering)
3. TimelineBlock (ordered timeline)
4. DefinitionBlock (extract from inline, add accordion)
5. ToolListBlock (equipment/tool list)

### Phase 2: Cooking + Coding Blocks (1-2 weeks)
**Goal:** Build 6 category blocks + 2 view updates

**Cooking (3):**
1. IngredientBlock (checkbox list with scaler)
2. StepBlock (numbered step with timer)
3. NutritionBlock (nutrition facts card)
4. RecipeSection (organism)
5. RecipeView update

**Coding (3):**
1. CodeBlock (syntax highlighted with Shiki/Prism)
2. TerminalBlock (CLI command display)
3. FileTreeBlock (directory tree visualization)
4. CodeSection (organism)
5. CodeView update

### Phase 3: Reviews + Travel + Fitness (1-2 weeks)
**Goal:** Build 8 category blocks + 3 new views

**Reviews (3):**
1. ProConBlock (pros vs cons columns)
2. RatingBlock (score display with stars/bars)
3. VerdictBlock (recommendation card)
4. ReviewSection + ReviewView

**Travel (3):**
1. LocationBlock (place card with map link)
2. ItineraryBlock (day-by-day schedule)
3. CostBlock (price breakdown table)
4. TravelSection + TravelView

**Fitness (2):**
1. ExerciseBlock (exercise card with sets/reps)
2. WorkoutTimerBlock (interval timer with controls)
3. WorkoutSection + FitnessView

### Phase 4: Education + Podcast + Remaining (1-2 weeks)
**Goal:** Build 3 category blocks + 4 new views

**Education (2):**
1. QuizBlock (interactive Q&A with reveal)
2. FormulaBlock (math/equation display with KaTeX)
3. EducationView

**Podcast (1):**
1. GuestBlock (speaker bio card)
2. InterviewSection + PodcastView

**Remaining Views:**
1. DIYView (reuses ToolListBlock, StepBlock)
2. GamingView (reuses RatingBlock, ProConBlock)

### Phase 5: Memorized + Collections UI (1 week)
**Goal:** Build memorized item display components

1. MemorizedGrid (grid layout for items)
2. MemorizedItemDetail (full item view)
3. MemorizedBlockList (block list with actions)
4. VideoSourceCard (video thumbnail + link)
5. UserNotesCard (editable notes)
6. CollectionsPanel, CollectionDialog, CollectionPicker

### Phase 6: RAG Chat Integration (1 week)
**Goal:** Render blocks in chat responses

1. RAGChatPanel (chat interface)
2. RAGSourceCard (source attribution card)
3. Streaming block support
4. Block highlighting in chat context

---

## Risk Assessment & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Breaking changes from Section→Chapter rename | High | Medium | Create migration script, add deprecation warnings |
| Performance with many blocks | Medium | Medium | Implement lazy loading, virtualization for >50 blocks |
| Inconsistent block rendering | Medium | Low | Single ContentBlockRenderer source of truth |
| Third-party library issues (KaTeX, Shiki) | Low | Medium | Provide fallback rendering, lazy load |
| Mobile layout issues | Medium | Medium | Test all blocks at 375px viewport |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Block type coverage | 31 blocks | Count in ContentBlockRenderer |
| Category view coverage | 10 views | Views exported from views/index.ts |
| Test coverage | 100% for blocks | Unit + a11y tests per block |
| Performance | <100ms block render | Lighthouse performance audit |
| A11y compliance | Zero axe violations | jest-axe per block |
| Responsive design | All blocks work at 375px | Visual regression tests |

---

## Required Resources & Dependencies

### New Dependencies

| Package | Purpose | Phase |
|---------|---------|-------|
| `shiki` or `prism-react-renderer` | Syntax highlighting | Phase 2 |
| `katex` | Math formula rendering | Phase 4 |
| `@tanstack/react-virtual` | Virtualization (if needed) | Phase 5+ |
| `react-intersection-observer` | Block analytics | Optional |

### Existing Dependencies (Sufficient)

- React 18+
- TypeScript 5+
- Tailwind CSS v4
- shadcn/ui components
- Lucide icons

### Files to Modify

| File | Phase | Changes |
|------|-------|---------|
| `packages/types/src/index.ts` | 0 | Section→Chapter, add blockId, MemorizedItem |
| `apps/web/src/index.css` | 0 | Category CSS variables |
| `components/video-detail/ArticleSection.tsx` | 0 | Rename to ChapterSection |
| `components/video-detail/ContentBlockRenderer.tsx` | 1-4 | Add new block cases |
| `components/video-detail/VideoDetailLayout.tsx` | 0 | Category routing |
| `components/video-detail/views/index.ts` | 2-4 | Export new views |

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 0: Foundation | 3-4 days | None |
| Phase 1: Universal Blocks | 5-7 days | Phase 0 |
| Phase 2: Cooking + Coding | 7-10 days | Phase 1 |
| Phase 3: Reviews + Travel + Fitness | 7-10 days | Phase 1 |
| Phase 4: Education + Podcast + Remaining | 7-10 days | Phase 1 |
| Phase 5: Memorized + Collections | 5-7 days | Phase 2-4 |
| Phase 6: RAG Chat | 5-7 days | Phase 5 |

**Total: 6-8 weeks** (with parallel work possible in Phases 2-4)

---

## Notes

1. **Phases 2-4 can run in parallel** if multiple developers are available
2. **Backend changes required**: Block generation must include blockId (UUID)
3. **Migration path**: Old summaries without blockId need graceful handling
4. **Feature flags**: Consider flagging new views until tested
5. **Storybook**: Each block needs stories (default, empty, edge cases, themes)
