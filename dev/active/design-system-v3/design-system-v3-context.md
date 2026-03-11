# VIE Design System v3.2 — Context

Last Updated: 2026-03-09
Status: **✅ ALL PHASES COMPLETE**

---

## Key Files

### Frontend — Output System
| File | Purpose |
|------|---------|
| `apps/web/src/components/video-detail/output/OutputRouter.tsx` | Entry point, dispatches to OutputShell |
| `apps/web/src/components/video-detail/output/OutputShell.tsx` | Hero + tabs + content layout |
| `apps/web/src/components/video-detail/output/OutputContent.tsx` | Switch/case router to *Tabs components |
| `apps/web/src/components/video-detail/output/TabLayout.tsx` | Tab bar UI + section management |
| `apps/web/src/components/video-detail/output/GlassCard.tsx` | Glass morphism card (4 variants) |
| `apps/web/src/components/video-detail/output/output-views/*.tsx` | 10 output view tabs |
| `apps/web/src/components/video-detail/blocks/` | 27 block components |
| `apps/web/src/components/video-detail/blocks/block-labels.ts` | Block label registry (used by 20+ blocks) |
| `apps/web/src/index.css` | Design tokens, OKLCH colors, animations |

### Types
| File | Purpose |
|------|---------|
| `packages/types/src/output-types.ts` | 10 output type interfaces, IntentResult, VideoOutput |
| `packages/types/src/index.ts` | Core types: User, VideoContext, ContentBlock |

### Backend — Summarizer Pipeline
| File | Purpose |
|------|---------|
| `services/summarizer/src/routes/stream.py` | SSE endpoint (~970 lines, ~600 dead) |
| `services/summarizer/src/services/pipeline/intent_detector.py` | Intent detection (174 lines) |
| `services/summarizer/src/services/pipeline/extractor.py` | Adaptive extraction (229 lines) |
| `services/summarizer/src/services/pipeline/enrichment.py` | Quiz/flashcard gen (64 lines) |
| `services/summarizer/src/services/pipeline/synthesis.py` | TLDR/takeaways (41 lines) |
| `services/summarizer/src/services/pipeline/pipeline_helpers.py` | Utilities (520 lines, ~250 dead) |
| `services/summarizer/src/models/output_types.py` | 10 Pydantic output models (578 lines) |
| `services/summarizer/src/prompts/` | All prompt template files |

### Backend — API Gateway
| File | Purpose |
|------|---------|
| `api/src/routes/stream.routes.ts` | SSE proxy + persistence layer |

---

## Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | 8 domains, not 10 or 12 | Merged gaming→tech, wellness→fitness, narrative→modifier, finance→sub-field |
| 2 | Modifiers enrich primary domains | narrative/finance add optional fields, NOT separate extraction |
| 3 | One base template + injected schemas | Voice rules updated once, not per-domain. Prompt scales with tags. |
| 4 | Triage replaces intent detection | LLM picks tags + designs tabs in one call |
| 5 | TabCoordinationContext = 4 fields | activeTab, setActiveTab, completedTabs, markTabCompleted |
| 6 | LINK_RULES table for cross-tab | Deterministic, no LLM needed. Code resolves based on present tabs. |
| 7 | Celebrations on natural-fit only | Checklists, quizzes, flashcard decks. NOT on display-only tabs. |
| 8 | Feature flag for Phase 3 | Build new path fully. Flip when ready. Old path = rollback. |
| 9 | SpotCard for spots/restaurants/gear only | NOT universal. Domain blocks stay separate. |
| 10 | `displayIn` routing KILLED | Accept minor data redundancy over routing complexity. |
| 11 | ViewMode abstraction KILLED | Per-type theming + section accents instead. |

---

## Domain → Current Output Type Mapping

Shows how current 10 types map to new 8 domains:

| New Domain | Current Output Type(s) | Notes |
|------------|----------------------|-------|
| `travel` | `trip_planner` | Direct mapping |
| `food` | `recipe` | Direct mapping |
| `tech` | `code_walkthrough` | Absorbs gaming |
| `fitness` | `workout` | Absorbs wellness |
| `music` | `music_guide` | Direct mapping |
| `learning` | `explanation`, `study_kit` | Merged into one domain |
| `review` | `verdict` | Direct mapping |
| `project` | `project_guide` | Direct mapping |
| (modifier) `narrative` | `highlights` | Becomes modifier, not standalone domain |
| (modifier) `finance` | — | New, was never a type |

**Key insight:** `explanation` and `study_kit` merge into `learning`. `highlights` becomes the `narrative` modifier. This reduces 10 → 8 primary + 2 modifiers.

---

## Current Tab IDs (Frontend Contract)

These are the switch/case values in each *Tabs.tsx file that MUST be supported:

| Output View | Tab IDs |
|-------------|---------|
| ExplanationTabs | key_points, concepts, takeaways, timestamps |
| RecipeTabs | overview, ingredients, steps, tips |
| CodeTabs | overview, setup, code, patterns, cheat_sheet |
| StudyTabs | overview, concepts, flashcards, quiz |
| TripTabs | trip, budget, pack |
| WorkoutTabs | overview, exercises, timer, tips |
| VerdictTabs | overview, pros_cons, specs, verdict |
| HighlightsTabs | speakers, highlights, topics |
| MusicTabs | credits, analysis, structure, lyrics |
| ProjectTabs | overview, materials, tools, steps, safety |

**In v3.2:** These fixed IDs are replaced by LLM-designed tab IDs from triage. The new composable renderer reads tab definitions, not hardcoded switch/case.

---

## SSE Event Types (Current)

```
metadata            → { title, channel, thumbnailUrl, duration }
transcript_ready    → { duration }
intent_detected     → { outputType, confidence, userGoal, sections[] }
description_analysis → { tags, hasLinks }
extraction_progress → { section, percent }
extraction_complete → { outputType, data }
enrichment_complete → { quiz[], flashcards[], cheatSheet[] }
synthesis_complete  → { tldr, keyTakeaways, masterSummary, seoDescription }
done                → { videoSummaryId, processingTimeMs, cached }
error               → { message, code }
```

**In v3.2:** `intent_detected` becomes `triage_complete` with contentTags, modifiers, tabs[], sections. `extraction_complete` carries domain-keyed data instead of flat output. New events may include `tab_progress` per-domain.

---

## Design Tokens (Relevant to v3.2)

### Existing --vie-* Variables
```css
--vie-glass, --vie-glass-border    /* Glass card backgrounds */
--vie-nav-bg                       /* Nav transparency */
--vie-accent-coral, plum, mint     /* Primary accents */
--vie-accent-sky, honey, rose      /* Rare accents */
```

### New Variables (v3.2)
```css
--vie-section-0 through --vie-section-6   /* Section accent colors (7 OKLCH) */
--vie-accent-muted                        /* CrossTabLink background */
--vie-accent-border                       /* CrossTabLink border */
--vie-accent                              /* CrossTabLink text */
```

---

## Feature Flag Strategy

No existing feature flag system. Options:

1. **Environment variable** — `VIE_RESPONSE_VERSION=v3` in summarizer .env
2. **DB toggle** — field in videoSummaryCache or app config collection
3. **Override state** — existing `override_state.py` pattern (in-memory map)

**Recommendation:** Environment variable for Phase 3. Simple, no DB schema change, restart to toggle. For per-request testing, extend existing override_state.

---

## Related Active Tasks

| Task | Relationship | Status |
|------|-------------|--------|
| `output-quality-fix` | **PREREQUISITE** — fixes tab ID mismatches in current system | Done |
| `pipeline-cleanup` | **PREREQUISITE** — removes dead code, cleans pipeline | Done |
| `block-simplification` | **COMPLETE** — 32→27 blocks, foundation for new blocks | Done |
| `plan1-frontend-ux` | May overlap with Phase 4 polish | Ready |

---

## Test Strategy

| Layer | Tool | What to Test |
|-------|------|-------------|
| Block components | Vitest + Testing Library | Render, interactions, edge cases |
| TabCoordinationContext | Vitest | State transitions, completion tracking |
| Cross-tab links | Vitest | LINK_RULES resolution |
| Celebrations | Vitest | Trigger conditions, next-tab navigation |
| Triage prompt | Manual + snapshot | 20+ videos across domains |
| Domain schemas | Pydantic unit tests | Validation, defaults, modifiers |
| New SSE events | API integration tests | Event format, ordering |
| Feature flag | Integration test | Toggle between old/new path |
| E2E (new path) | Playwright | Full flow with new response shape |
