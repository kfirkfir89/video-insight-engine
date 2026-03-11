# VIE Design System v3.2 — Implementation Plan

Last Updated: 2026-03-09

---

## Executive Summary

Rearchitect VIE from 10 fixed output types to an 8-domain composable system with LLM-driven tab design, template-based prompt architecture, and 6 new interactive blocks. Migration behind feature flag — old path is rollback.

**Scale:** ~60 tasks across 4 phases, touching summarizer pipeline, TypeScript types, frontend output system, and prompt engineering.

**Prerequisites:** `output-quality-fix` (tab ID alignment) and `pipeline-cleanup` (dead code removal) should complete first. v3.2 builds on a clean, working pipeline.

---

## Current State Analysis

### What Exists (Working)

| Component | State | Files |
|-----------|-------|-------|
| 10 output types | Live, validated | `packages/types/src/output-types.ts`, `services/summarizer/src/models/output_types.py` |
| 10 frontend tabs | Rendering | `apps/web/src/components/video-detail/output/output-views/*.tsx` |
| 4-stage pipeline | Working | `services/summarizer/src/services/pipeline/` (intent → extract → enrich → synthesis) |
| 10 extraction prompts | Weak (~50 lines each) | `services/summarizer/src/prompts/extract_*.txt` |
| 27 block components | Consolidated | `apps/web/src/components/video-detail/blocks/` |
| SSE streaming | Stable | `services/summarizer/src/routes/stream.py`, `api/src/routes/stream.routes.ts` |
| OKLCH design tokens | Complete | `apps/web/src/index.css` |
| Adaptive extraction | Working | Single/overflow/segmented by word count |

### What Changes

| From (Current) | To (v3.2) |
|----------------|-----------|
| 10 fixed output types | 8 primary domains + 2 modifiers |
| Intent detection → 1 canonical type | Triage → 1-3 content tags + modifiers |
| 10 separate extraction prompts | 1 base template + injected domain schemas |
| Fixed sections per type | LLM-designed tabs (id, label, order, dataSource) |
| No cross-tab state | TabCoordinationContext (4 fields) |
| No celebrations | Celebration component on checklists/quizzes |
| No cross-tab links | LINK_RULES table + CrossTabLink component |
| Prop-drilled tab state | Context-based tab coordination |

### Architecture Delta

```
CURRENT PIPELINE:
  intent_detect → extract_{type} → enrich → synthesize
  (1 fixed type, 1 prompt file, hardcoded sections)

NEW PIPELINE:
  triage → extract(base_template + domain_schemas) → enrich → synthesize
  (1-3 tags, composable prompts, LLM-designed tabs)
```

---

## Proposed Future State

### Domain Taxonomy

8 primary domains: `travel`, `food`, `tech`, `fitness`, `music`, `learning`, `review`, `project`
2 modifiers: `narrative`, `finance` (enrich primary domains with optional fields)

### Pipeline (4 stages, same count as current)

```
STAGE 1: TRIAGE (replaces intent_detect)
  → content tags (1-3 domains)
  → modifiers (0-2)
  → user goal
  → tabs (id + label + order + dataSource)
  → sections (days, chapters, exercises)

STAGE 2: EXTRACTION (replaces extract_{type})
  → base_extraction.txt + injected schemas/{domain}.txt
  → voice rules centralized in base template
  → adaptive splitting unchanged (token-based)

STAGE 3: ENRICHMENT (unchanged)
  → quiz/flashcards/scenarios for learning/tech tags

STAGE 4: SYNTHESIS (unchanged)
  → TLDR, takeaways, master summary, SEO
```

### Response Shape

```typescript
interface VIEResponse {
  meta: { videoId, videoTitle, creator, contentTags[], modifiers[], primaryTag, userGoal };
  tabs: TabDefinition[];       // LLM-designed
  sections?: SectionDefinition;
  travel?: TravelData;         // Only populated domains present
  food?: FoodData;
  tech?: TechData;
  // ... 8 domains total
  narrative?: NarrativeData;   // Modifier enrichment
  quizzes?: QuizItem[];        // Stage 3 enrichment
  scenarios?: ScenarioItem[];
}
```

### New Components (6)

| Component | Purpose |
|-----------|---------|
| SpotCard | Spots, restaurants, gear, products (expandable) |
| ScoreRing | Verdict scores, quiz results, ratings |
| FlashCard | Learning concepts, music theory (flip interaction) |
| CrossTabLink | Bottom-of-tab navigation between tabs |
| Celebration | Checklist/quiz/flashcard completion |
| ScenarioCard | "Which X?" learning challenges |

---

## Implementation Phases

### Phase 1: Blocks + Context (Foundation)

**Goal:** Ship 6 new components + TabCoordinationContext. Each ships independently. No pipeline changes. No breaking changes.

**Why first:** Components are needed by Phase 3 renderers. Building them now with the current system proves they work in isolation.

**Effort:** M-L per component, S for context

### Phase 2: Extraction Quality (Prompt Architecture)

**Goal:** Replace 10 separate extraction prompts with base template + domain schema injection. Write triage prompt. Add cross-tab link resolver + post-processing.

**Why second:** Improves output quality immediately within the CURRENT pipeline shape. No frontend changes needed. New prompts can be tested via existing SSE + override system.

**Effort:** L (prompt engineering + Python restructuring)

### Phase 3: Response Shape Migration (Behind Feature Flag)

**Goal:** New VIEResponse types (TS + Pydantic), new composable tab renderer, SSE event changes, feature flag toggle. Old path = rollback.

**Why third:** This is the breaking change. Everything before this is additive. Feature flag means zero user impact until ready.

**Effort:** XL (full-stack migration, feature flag infra)

### Phase 4: Polish

**Goal:** Section selector with emoji + accents, tab completion badges, narrative modifier rendering.

**Why last:** Visual polish on a working system.

**Effort:** M

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Prompt regression** — new template produces worse output than current prompts | High | Medium | A/B test on 20+ videos across domains before flip. Keep old prompts as rollback. |
| **Triage misclassification** — LLM picks wrong tags/tabs | Medium | Medium | Confidence threshold + fallback to current intent system. Log all triage results. |
| **Feature flag complexity** — two codepaths create maintenance burden | Medium | High | Time-box Phase 3 to 3 weeks. Flip or revert, don't maintain both. |
| **Tab ID explosion** — LLM-generated tab IDs don't match renderer expectations | High | Low | Constrain triage prompt to known tab ID vocabulary. Validate in post-processing. |
| **Token budget exceeded** — multi-schema injection + long transcript > context window | Medium | Low | Existing adaptive splitting handles this. Test with injected schema overhead. |
| **SSE event format change breaks frontend** — new events not handled | High | Low | Feature flag isolates. New event types are additive, not replacing. |
| **Scope creep** — 8 domains * N schemas = too many files | Medium | Medium | Start with 4 domains (travel, food, learning, review). Add rest incrementally. |

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Domain coverage | 8 primary + 2 modifiers | Schema files + Pydantic models exist |
| Extraction quality | >=80% field completeness on test videos | Manual review of 5 videos per domain |
| Tab relevance | Users don't see blank/empty tabs | Post-processing drops tabs with <2 items |
| Cross-tab usage | Links render and navigate correctly | E2E tests for each LINK_RULE |
| Celebration triggers | Fire on 100% completion only | Unit tests for trigger conditions |
| Feature flag rollback | <5 min to revert | Toggle in DB/env, no deploy needed |
| No regression | All existing 1053 unit + 136 e2e tests pass | CI green |

---

## Dependencies

### Must Complete First
- `output-quality-fix` — Tab ID alignment (currently broken in 9/10 types)
- `pipeline-cleanup` — Remove ~2,355 dead lines, restructure services/

### External Dependencies
- None (all LLM providers already integrated via LiteLLM)

### Internal Dependencies Between Phases
```
Phase 1 (Blocks) ──→ Phase 3 (new renderers USE these blocks)
Phase 2 (Prompts) ──→ Phase 3 (new response shape CONSUMES new extraction output)
Phase 1 + Phase 2 ──→ Phase 3 (both must be stable before migration)
Phase 3 ──→ Phase 4 (polish requires working new system)
```

Phase 1 and Phase 2 are **independent** — can be worked in parallel.
