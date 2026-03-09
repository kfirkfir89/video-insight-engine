# Pipeline v2: Implementation Plan

> Last Updated: 2026-03-04 (Session 3 — post-UOS rewrite)
> Branch: `dev-1`

---

## Executive Summary

Replace chapter-based summarization (18-25 LLM calls) with intent-driven structured extraction (4-7 LLM calls). The frontend, types, API layer, and streaming infrastructure are **DONE** (completed by unified-output-system task). What remains is the Python backend: fleshing out service stubs, validating prompts with real videos, cleaning up the pipeline orchestration, and wiring dependent services.

**Key metrics (targets):**
- LLM calls: 18-25 → 4-7 (~65% reduction)
- Cost per video: $0.15-0.50 → $0.06-0.18 (~55% reduction)
- Latency: 25-70s → 10-25s (~50% reduction)
- Output types: generic blocks → 10 purpose-built typed schemas

---

## What's Already Done (UOS completed)

| Component | Status | Location |
|-----------|--------|----------|
| TypeScript output types (canonical names) | DONE | `packages/types/src/output-types.ts` |
| Python Pydantic models (file exists) | DONE (needs naming cleanup) | `services/summarizer/src/models/output_types.py` |
| All 10 frontend output-view tabs | DONE | `apps/web/src/components/video-detail/output/output-views/` |
| OutputRouter, OutputShell, GlassCard, TabLayout, OutputHero | DONE | `apps/web/src/components/video-detail/output/` |
| SSE streaming hook + event processor | DONE | `apps/web/src/hooks/use-summary-stream.ts`, `apps/web/src/lib/stream-event-processor.ts` |
| API repository, routes, video service | DONE | `api/src/` |
| Design tokens (gradients, glass, animations) | DONE | `apps/web/src/index.css` |
| V1 deletion + V2→canonical rename | DONE | All V1 code removed, no version branching |
| Block consolidation (ListBlock) | DONE | `apps/web/src/components/video-detail/blocks/ListBlock.tsx` |

---

## What Remains

### Phase A: Python Backend — Flesh Out Stubs (CORE)
**Goal:** Turn the existing stub files into working implementations.

**Files to expand:**
1. `intent_detector.py` (49 lines → full implementation) — detect user goal from metadata + transcript preview
2. `extractor.py` (197 lines → complete adaptive extraction) — Single/Overflow/Segmented strategies with Pydantic validation + retry
3. `enrichment.py` (40 lines → working enrichment) — quiz, flashcards, cheat sheet
4. `synthesis_v2.py` (30 lines → working synthesis) — then rename to `synthesis.py`

**Naming cleanup (UOS Phase 8 leftovers):**
- `output_types.py`: `OutputTypeV2` → `OutputType`, `smart_summary` → `explanation`
- `synthesis_v2.py` → `synthesis.py`, `synthesis_v2.txt` → `synthesis.txt`
- Delete any remaining V1 prompts (chapter_detect, chapter_summary, etc.)
- Update all Python imports

**Acceptance criteria:**
- All services produce valid Pydantic output
- Adaptive extraction handles short (<4K words), medium (4-15K), and long (15K+) transcripts
- Intent detection falls back to `explanation` when confidence < 0.6

---

### Phase B: Prompt Validation
**Goal:** Validate all 10 extraction prompts + 2 enrichment prompts with real videos.

Each of the 10 `extract_*.txt` prompts needs testing with 5+ real videos of the matching type. Focus on:
- Field completeness (>90%)
- Specificity (exact amounts, real code, verbatim quotes — not summaries)
- Adaptive extraction working across short/medium/long transcripts
- Pydantic validation passing without manual fixes

---

### Phase C: Pipeline Orchestration & Cleanup
**Goal:** Make the new pipeline the ONLY path. No version routing.

**Changes to `stream.py`:**
- Remove v1/v2 routing logic — there is one pipeline
- Rename `stream_summarization_v2()` → `stream_summarization()` (or equivalent)
- Wire `extraction_progress` SSE events during adaptive extraction
- Verify Pydantic catches malformed output and retries

---

### Phase D: Dependent Services
**Goal:** Wire share page, memorized items, and explainer to use typed output data.

- **Share page:** Render output data directly (no version check)
- **Memorized items:** Section-level selection for typed outputs
- **Explainer:** Serialize typed output as structured text for chat context

---

### Phase E: Testing & Validation
**Goal:** Comprehensive testing and performance validation.

- Pydantic validation tests for all 10 output types (positive + negative)
- Extractor tests: adaptive strategy selection, truncation detection, merge
- Integration tests: each output type with real transcript fixtures
- SSE integration: verify event sequence and payload shapes
- Performance benchmark: calls, latency, cost for 20 test videos
- Edge cases: very short (<2min), very long (3h+), no transcript, live stream

**Targets:**
- 4-7 LLM calls per video
- <25s latency for <60min videos
- <$0.18 cost per video
- >80% test coverage on new code

---

## Pipeline Architecture

```
Phase 1 (instant): yt-dlp metadata → pre_detection hint → SponsorBlock
Phase 2 (parallel): intent detection + description analysis
Phase 3 (adaptive): structured extraction (1-3 calls based on length)
Phase 4 (conditional): enrichment (0-1 calls)
Phase 5: synthesis (1 call)
Save + done
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Token overflow on extraction | Truncated output | Adaptive strategy (1-3 calls) + Pydantic validation + retry |
| Extraction dead zone UX | 5-10s no progress | `extraction_progress` SSE events |
| Wrong intent detection | Wrong prompt = bad output | Rule-based pre_detection as sanity check, fallback to `explanation` |
| 10 prompts need tuning | Each needs 5+ real tests | Dedicated Phase B for prompt validation |
| Enrichment quality | Low-quality quiz/flashcards | Make enrichment optional/skippable |

---

## Dependencies

```
Phase A (Python Stubs)
├── Phase B (Prompt Validation)
├── Phase C (Pipeline Cleanup)
│   └── Phase D (Dependent Services)
└── Phase E (Testing)
```

Phase B and C can run in parallel once A is done.
Phase D needs C (clean pipeline).
Phase E can start partially during B/C.

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| LLM calls per video | 4-7 | `llm_usage` collection |
| Cost per video | <$0.18 | `llm_usage` cost tracking |
| Latency (time to done) | <25s for <60min | SSE `done` timestamp - start |
| Extraction accuracy | >90% field completeness | Manual review of 50 outputs |
| Test coverage (new code) | >80% | pytest coverage |
