# Extraction Cost & Pipeline Dedup Overhaul — Plan

**Last Updated:** 2026-04-26
**Status:** Ready for Implementation
**Effort:** XL (8–12 developer-days across 5 phases)
**Source brief:** `/home/kfir/.claude/plans/create-a-complete-plan-foamy-star.md`

---

## Executive Summary

A 108-min Matt Pocock livestream cost **$0.494** to process — 85% of that ($0.418) was extraction. Five compounding problems were diagnosed:

1. **Wasted retry trigger** — plan over-promised step counts; livestream returned 0; hard-miss retry fired and burned **$0.205 + 188s** for no improvement.
2. **Chunked → overflow collapse** — 22 chapters fit in 1 batch under `MAX_TOKENS_PER_BATCH=50_000`, so chunked strategy collapsed to a single 158s Sonnet call. Parallelism never engaged.
3. **No per-batch UX feedback** — frontend shows static "Extracting…" for the entire ~3 min, not per-batch progress.
4. **Possible silent cache miss** — `cache_control: ephemeral` is wired, but the cost callback only tracks `cache_hit` boolean, not `cache_creation_input_tokens` / `cache_read_input_tokens`. Cache savings may not be reaching cost numbers.
5. **Duplicate pipeline triggers on refresh** — summarizer-side dedup works correctly via Redis lock, but the frontend opens `/stream` unconditionally on every `/video/:id` mount even when the existing record is `COMPLETED`.

**Goal:** cut per-video extraction cost ~50% (target: **$0.05–0.13** down from **$0.494**) without quality regressions, give users live per-batch progress, and prevent duplicate pipeline triggers from the frontend.

**Rollout order:** P0+P3+dedup ship together → P4 → P1 → P2 (gated on corpus eval).

---

## Current State Analysis

### Cost breakdown (Matt Pocock 108-min livestream)

| Stage          | Current cost | Target cost | Driver                                |
|----------------|--------------|-------------|---------------------------------------|
| metadata       | ~$0.001      | ~$0.001     | unchanged                             |
| frames vision  | $0.034       | $0.005      | Sonnet → fast model (~6× cheaper)     |
| chapter_detect | $0.011       | $0.002      | Sonnet → fast model (~6× cheaper)     |
| extraction (1st pass) | $0.213 | $0.02–$0.20 | depends on P2 rollout state          |
| extraction (retry)    | $0.205 | **$0.00**   | format-aware gating skips livestreams |
| synthesis + enrich    | ~$0.030 | ~$0.030     | unchanged (already fast model)        |
| **Total**      | **$0.494**   | **$0.05–0.13** | 75–90% reduction                   |

### Pain points

- `decide_extraction_retry` only considers overall score + hard-miss; it has no signal for `content_format` or `content_traits`. Step-like fields on narrative content (livestream, vlog, podcast) trip the hard-miss retry even when skip is the correct call.
- `_resolve_strategy` in `extractor.py` collapses to overflow whenever batch count == 1, even when force-splitting into 4 sub-batches would unlock parallelism.
- `complete_with_messages` in `llm_provider.py` lacks a `use_fast_model` parameter, so frame_analyzer and chapter_detect can't currently route to fast model.
- `UsageRecord` in `packages/llm-common/src/llm_common/models.py` has no fields for `cache_creation_input_tokens` / `cache_read_input_tokens`; cache savings are invisible in the admin dashboard.
- `stream-registry.ts:99` opens `/stream` unconditionally on page mount; React Query already has `videosApi.getById(id)` cached but isn't consulted before subscribing.

---

## Proposed Future State

1. **Format-aware retry gating** — narrative formats (`livestream`, `vlog`, `podcast`, etc.) and `has_narrative` / `is_opinionated` traits skip hard-miss retry for step-like fields. High-score (>=0.7) results never trigger hard-miss retry.
2. **Fast model for frames + chapter_detect** — `complete_with_messages` accepts `use_fast_model`; vision and chapter detection route to `gpt-4o-mini` (~6× cheaper than Haiku).
3. **Cache cost crediting** — `UsageRecord` carries `cache_creation_tokens`, `cache_read_tokens`, `cache_savings_usd`; admin dashboard shows real cache impact.
4. **Frontend dedup** — `/video/:id` mount reads cached `videosApi.getById(id)` first; only opens `/stream` when status is `PROCESSING`/`PENDING`/`FAILED`.
5. **Force-split + per-batch SSE** — single-batch chunked transcripts force-split into 3–4 sub-batches; each batch emits `extraction_progress` SSE events; rate-limit detection triggers sequential fallback with explicit `chunked-sequential` section marker.
6. **Fast-model-first extraction (gated)** — `EXTRACTION_USE_FAST_FIRST` flag routes first-pass extraction to fast model; primary model becomes the safety-net retry. Ships only after corpus eval shows quality delta < 0.05.

---

## Phasing Summary

| Order | Phase                                              | Risk        | Expected savings                       |
|-------|----------------------------------------------------|-------------|----------------------------------------|
| 1     | **P0 + P3** retry-trigger fix + frames/chapter fast model | Low         | $0.04–0.22/video                  |
| 2     | **P4** cache cost-credit audit                     | Low (read-only first) | Up to $0.10/video if miscredited |
| 3     | **Pipeline dedup** frontend status check           | Low         | Eliminates duplicate $0.20+ runs       |
| 4     | **P1** force-split + per-batch SSE + rate-limit fallback | Medium | UX win + 30–50% wall-time on long videos |
| 5     | **P2** fast-model-first extraction with corpus eval | Medium-high (gated) | $0.13/video on 70%+ of videos    |

**Note on "fast model":** `use_fast_model=True` routes to `settings.fast_model`. Currently `openai/gpt-4o-mini` (per `config.py:15-19`). The plan stays provider-agnostic — anywhere we say "fast model," we mean whatever's configured.

---

## Phase 1 — P0: Format-aware, score-gated retry trigger

### Files
- `services/summarizer/src/services/pipeline/extraction_quality.py`
- `services/summarizer/src/services/pipeline/phases/extraction.py`
- `services/summarizer/tests/test_extraction_quality.py` (extend)

### Changes

**`extraction_quality.py`:**
- Add `HARD_MISS_SCORE_GATE = 0.7` constant.
- Add `NARRATIVE_FORMATS = frozenset(["vlog", "commentary", "opinion_rant", "motivational", "podcast", "news", "news_commentary", "entertainment", "performance", "story", "reaction", "interview"])`.
- Add `STEP_LIKE_FIELDS = frozenset(["steps", "drills", "exercises", "ingredients", "itinerary"])` — fields whose absence on narrative content is *expected*.
- Extend `decide_extraction_retry(...)` signature with two optional kwargs:
  - `content_format: str | None = None`
  - `content_traits: ContentTraits | None = None` (import from `services.pipeline.classifier`)
- New gating logic in `decide_extraction_retry`:
  1. Filter `hard_miss_fields`: drop entries in `STEP_LIKE_FIELDS` when `content_format in NARRATIVE_FORMATS` OR (`content_traits.has_narrative` or `content_traits.is_opinionated`). Log skip reason.
  2. Hard-miss retry **only fires when** `quality.score < HARD_MISS_SCORE_GATE`. If overall score >= 0.7, accept the gap.
  3. Low-score retry path stays unchanged (`< RETRY_SCORE_THRESHOLD = 0.6`).

**`phases/extraction.py:173`:**
- Pass `content_format=ctx.content_format, content_traits=ctx.content_traits` into `decide_extraction_retry`. Both are already populated on `PipelineContext` (context.py:62-63) by the classifier phase, which runs before extraction.

### Acceptance criteria
- Livestream/podcast video with hard-miss `steps` + score >= 0.7 → no retry fires.
- Tutorial video with hard-miss `steps` + score < 0.7 → retry fires.
- Existing low-score retry behavior unchanged.

### Tests
- Table-driven `decide_extraction_retry` cases:
  - narrative-format + hard-miss in step field → skip
  - tutorial-format + hard-miss in step field → fire
  - high-score (>=0.7) + hard-miss → skip
  - low-score (<0.6) + hard-miss in non-step field → fire
- Integration: phases/extraction.py call wires `content_format`/`content_traits` correctly.

### Effort: S (0.5–1 day)

---

## Phase 1 — P3: Move frames vision + chapter_detect to fast model

### Files
- `services/summarizer/src/services/llm_provider.py` (add `use_fast_model` param to `complete_with_messages`)
- `services/summarizer/src/services/media/frame_analyzer.py:131-134`
- `services/summarizer/src/services/transcription/transcript_chunker.py:292-296`
- `services/summarizer/tests/test_frame_analyzer.py`, `test_transcript_chunker.py`

### Changes

**`llm_provider.py: complete_with_messages`:**
- Add `use_fast_model: bool = False` parameter. When true, route to `settings.fast_model` instead of primary. Mirrors dispatch already in `call_llm_with_retry`.
- Fast model resolution lives in `config.py` (`LLM_FAST_MODEL` / `MODEL_ROUTING.fast`); this is a wiring change in the provider call.

**`frame_analyzer.py:131-134`:**
- Pass `use_fast_model=True` to `complete_with_messages`.
- Vision payload format (multimodal `messages` array) is portable across OpenAI/Anthropic — no schema change when fast model is `gpt-4o-mini`.

**`transcript_chunker.py:292-296`:**
- Add `use_fast_model=True` to existing `call_llm_with_retry(...)` call.

### Acceptance criteria
- `summarize:frames` cost drops from ~$0.034 to ~$0.005.
- `summarize:chapter_detect` (currently mis-tagged as `summarize:extraction`) drops from ~$0.011 to ~$0.002.
- Vision output quality on 5 sample frames is comparable to Sonnet (manual spot-check).

### Tests
- `test_frame_analyzer.py` mocks assert `use_fast_model=True` is propagated.
- `test_transcript_chunker.py` asserts underlying LLM call uses fast model.

### Verification
- Run summarizer on a sample tech tutorial; confirm dashboard rows for `frames` and `chapter_detect` reflect new costs.
- Spot-check vision output: gpt-4o-mini vision should be comparable to Sonnet for OCR/captioning. If a domain regresses (e.g., dense-text frames), override `LLM_FAST_MODEL=anthropic/claude-haiku-4-5-20251001` via env (no code change).

### Effort: S (0.5 day)

---

## Phase 2 — P4: Prompt-cache cost-credit audit

### Files (read-only investigation first)
- `packages/llm-common/src/llm_common/callback.py:70-139`
- `packages/llm-common/src/llm_common/models.py:8-29` (UsageRecord)
- `services/summarizer/src/services/llm_provider.py:162-178` (cache_control wiring)

### Step 1 — Diagnose (read-only)
Add temporary `logger.debug` inside `_build_record` to dump:

```python
hidden = getattr(response_obj, "_hidden_params", {}) or {}
usage = response_obj.usage
{
  "model": response_obj.model,
  "tokens_in": usage.prompt_tokens,
  "tokens_out": usage.completion_tokens,
  "cache_hit": hidden.get("cache_hit"),
  "cache_creation": getattr(usage, "cache_creation_input_tokens", None),
  "cache_read": getattr(usage, "cache_read_input_tokens", None),
  "litellm_cost": litellm.completion_cost(completion_response=response_obj),
}
```

Run two extractions back-to-back on the same video. Inspect logs:
- If `cache_read_input_tokens > 0` on second call AND `litellm_cost` reflects discount → just plumb fields into `UsageRecord`.
- If `cache_read_input_tokens > 0` but `litellm_cost` doesn't drop → LiteLLM isn't crediting cache for our model versions; compute cost manually.

### Step 2 — Fix (after diagnosis)
- Extend `UsageRecord` with `cache_creation_tokens: int = 0`, `cache_read_tokens: int = 0`, `cache_savings_usd: float = 0.0`.
- In `_build_record`, parse cache token fields off `response_obj.usage`.
- If LiteLLM under-credits, add per-model rate map for cache reads (verify against Anthropic pricing at merge time):
  - Sonnet 4.6: $0.30/M read, $3.75/M write
  - Haiku 4.5: $0.10/M read, $1.25/M write
  - Adjust `cost_usd` accordingly.
- Track admin dashboard plumbing as **follow-up** (out of scope here).

### Acceptance criteria
- Two back-to-back extractions on same video show `cache_read_tokens > 0` on the second.
- `cost_usd` on the second extraction reflects the cache discount (verified via manual price math).
- `UsageRecord` fields populate correctly across all LLM call sites.

### Tests
- `packages/llm-common/tests/test_callback.py`: add `MockResponse` variants with cache token fields; assert correct cost split.

### Effort: S–M (0.5–1 day)

---

## Phase 3 — Pipeline dedup: frontend-only status check

### Reframe
The summarizer-side dedup already works correctly:
- Redis lock `vie:pipeline:lock:{video_summary_id}` (`pipeline_event_stream.py:103-160`) atomically gates pipeline starts.
- `stream.py:418-448` short-circuits when `status == COMPLETED`.
- `stream.py:495-498` attaches refreshes as additional consumers when lock is held.
- POST `/videos` server-side dedupes by `youtubeId`.

The duplicate-trigger surface is purely on `/video/:id` page mount — `stream-registry.ts:99` calls `GET /videos/:id/stream` unconditionally on every mount, even when the existing record is `COMPLETED`.

### Files
- `apps/web/src/features/video-output/lib/streaming/stream-registry.ts`
- `apps/web/src/features/video-output/hooks/use-summary-stream.ts`
- `apps/web/src/pages/VideoDetail.tsx` (or equivalent page that mounts the SSE stream)

### Existing infrastructure to reuse
- `GET /api/videos/:id` returns full video record including `status` (`PENDING` | `PROCESSING` | `COMPLETED` | `FAILED`). No backend change needed.
- React Query is already used for video fetching — read the cached video record before deciding to start SSE.

### Changes — frontend only

On `/video/:id` mount, before initiating SSE stream:

1. **Fetch (or read cached) `videosApi.getById(id)` first.**
2. **Branch on `status`:**
   - `COMPLETED` → render cached output. Do **not** open `/stream`.
   - `PROCESSING` → open `/stream`. Summarizer's lock-acquire will fail; connection attaches as consumer. No duplicate pipeline.
   - `PENDING` or `FAILED` → open `/stream` to trigger fresh pipeline.
3. **Race-safety:** if `getById` errors or returns 404, fall through to current behavior (open `/stream`).

This is one `if`-statement in the page mount effect, plus a small refactor to read the video record before subscribing. No new endpoint, no schema changes, no summarizer changes.

### Acceptance criteria
- Refreshing on a `COMPLETED` video does not open `/stream`.
- Refreshing on a `PROCESSING` video opens `/stream` and attaches as consumer (no duplicate producer).
- Errors fetching `getById` still allow `/stream` to open.

### Tests
- Frontend Vitest: `VideoDetail` mount with each `status` value — assert `/stream` opens only for `PROCESSING`/`PENDING`/`FAILED`.
- E2E (Playwright): trigger pipeline, refresh page mid-stream, grep summarizer logs for `Attaching as additional consumer` (expected) and absence of a second `producer_lock_acquired` (must not occur).

### What we explicitly skip
- New `/api/videos/url-status` endpoint — overkill; existing `getById` serves this need.
- Lock TTL changes — existing infrastructure works.
- Checkpoint-and-resume after service restart — out of scope.

### Effort: S (0.5–1 day)

---

## Phase 4 — P1: Force-split single-batch chunked + per-batch SSE progress

### Files
- `services/summarizer/src/services/pipeline/extractor.py` (`_resolve_strategy`, `_chunked_extraction`)
- `services/summarizer/src/services/transcription/transcript_chunker.py` (verify `force_split_by_sentences` returns `ChapterChunk[]`)
- `apps/web/src/features/video-output/lib/streaming/stream-event-processor.ts:88-96`
- `apps/web/src/features/video-output/hooks/use-summary-stream.ts:87`
- `apps/web/src/features/video-output/components/OutputRouter.tsx:318-320`
- `services/summarizer/tests/test_extractor.py`, `test_chunked_extraction.py`

### Changes — backend

**`extractor.py:_resolve_strategy` (line 67–99):**
- When chunked is requested AND `len(batches) == 1`, instead of falling to overflow:
  1. Check if `word_count > SINGLE_THRESHOLD = 5333`. If transcript is genuinely small, use `single` strategy.
  2. Otherwise, call `_force_split_by_sentences(transcript, duration_seconds, target_chunks=4)` to produce 3–4 `ChapterChunk` objects. Re-batch via `batch_chapters()`.
  3. If force-split also yields 1 batch (extreme edge case), fall to overflow as last resort.
- Returns `("chunked", force_split_chunks)`.

**`extractor.py:_chunked_extraction` (line 359–423) — rate-limit aware execution:**
1. **Lower default concurrency.** Add `EXTRACTION_PARALLEL_BATCHES: int = 2` to `config.py`. Use as semaphore bound (`Semaphore(min(settings.EXTRACTION_PARALLEL_BATCHES, num_batches))`).
2. **Detect rate-limit per batch.** Each batch task wraps the LLM call in try/except. On rate-limit (HTTP 429/529 or `litellm.RateLimitError`), record `RATE_LIMIT_HIT` and return `None` rather than raising.
3. **Fall back to sequential on rate-limit.** After `asyncio.gather(*tasks, return_exceptions=False)`, if any batch returns `RATE_LIMIT_HIT`, run *those specific batches* sequentially with 2-second delay between calls. Successfully-completed parallel batches keep their results.
4. **Per-batch SSE progress in BOTH modes.** Use `asyncio.Queue` to push progress events from inside tasks back to the orchestrator (similar to `run_parallel_phases` in `pipeline_helpers.py`).
   - Kickoff: `{"event": "extraction_progress", "section": "chunked", "batch": 0, "of": N, "percent": 5}`
   - Per-batch completion: `{"event": "extraction_progress", "section": "chunked", "batch": k, "of": N, "percent": clamp(5 + 65*(k/N), 5, 70)}`
   - When fallback kicks in: `{"event": "extraction_progress", "section": "chunked-sequential", "batch": k, "of": N, ...}`
5. **Keep existing 70/85/100 markers** for merge → validation → done.

### Changes — frontend

**`stream-event-processor.ts:88-96`:**
- Extend `handleExtractionProgress` to read optional `batch` and `of` fields from event.
- Treat `section` values `"chunked"` and `"chunked-sequential"` both as "chunked extraction in progress"; keep raw value for differentiation.
- Map to new `extractionProgress` shape: `{ section, percent, batch?, of? }`.

**`use-summary-stream.ts:87`:**
- Update `extractionProgress` type to include optional `batch` and `of`.

**`OutputRouter.tsx:318-320`:**
- When `streamPhase === "extraction"` and `extractionProgress.of > 1`, render below phase label:
  - `Extracting batch {batch}/{of}…` with small bar showing `percent`.
  - If `section === "chunked-sequential"`, append quiet subtitle: `(running sequentially due to upstream load)`.
- For single-batch (legacy `single`/`overflow`), keep current label unchanged.

### Acceptance criteria
- 33K-token single-batch chunked input force-splits to >=3 batches.
- SSE emits `extraction_progress` events with `batch`/`of` fields each batch.
- Wall time drops from ~158s to ~50–60s in parallel mode (no rate-limit).
- Sequential fallback engages on simulated 429/529 and emits `chunked-sequential` events.
- Frontend UI shows `Extracting batch 1/4…` → `2/4…` etc.

### Tests
- `test_extractor.py`: assert single-batch chunked force-splits to >=3 batches and emits per-batch SSE events.
- `test_chunked_extraction.py`:
  - Happy path: parallel execution emits N progress events; final data shape unchanged.
  - Rate-limit path: simulate `RateLimitError` on batch 2 → assert remaining batches re-run sequentially → `section` switches to `"chunked-sequential"` mid-stream → all batches eventually succeed.
- Frontend Vitest: `stream-event-processor` parses `batch`/`of`; `OutputRouter` renders new sub-label.
- Manual: re-run Matt Pocock video; confirm UI shows `Extracting batch 1/4…` → `2/4…` etc.

### Performance note
- Parallel (no rate-limit): 158s → ~50–60s (cap = `EXTRACTION_PARALLEL_BATCHES = 2`).
- Sequential fallback (rate-limited): 158s → ~120–160s (same compute, live progress every 30–40s instead of 3min silence).
- Cost on primary model: roughly identical (linear pricing).
- Cost when paired with P2: drops dramatically — each ~8K-token batch fits well in `gpt-4o-mini`'s sweet spot.

### Effort: L (2–3 days)

---

## Phase 5 — P2: Fast-model-first extraction with primary fallback (gated)

### Files
- `services/summarizer/src/services/pipeline/extractor.py`
- `services/summarizer/src/services/pipeline/phases/extraction.py`
- `services/summarizer/src/config.py`
- New: `scripts/eval_extraction_models.py` (corpus comparison harness)

### Pre-merge gate — corpus evaluation

Build `scripts/eval_extraction_models.py`:
- Pulls 100 already-extracted videos from MongoDB across all `content_tags` (sample 10 per primary domain).
- Re-runs extraction on each transcript twice — once with primary, once with `use_fast_model=True`.
- Computes `check_extraction_quality(plan_tabs, extraction_data)` for both.
- Reports: per-domain quality delta, retry-trigger count delta, total cost difference.
- Manual review: 2 random samples per domain, side-by-side diff of extracted JSON.

**Acceptance criteria for rollout:**
- Average quality score delta < 0.05.
- Hard-miss rate increases < 5% absolute.
- No domain shows > 10% quality regression.

### Changes (after eval passes)

**`config.py`:**
- Add `EXTRACTION_USE_FAST_FIRST: bool = False` flag.

**`extractor.py` (`_single_extraction`, `_overflow_extraction`, `_chunked_extraction`):**
- All three pass `use_fast_model=settings.EXTRACTION_USE_FAST_FIRST` to `call_llm_with_retry`.

**`phases/extraction.py:_attempt_synthesis_fed_retry`:**
- Retry is the safety net. When `EXTRACTION_USE_FAST_FIRST=True` and retrying, force `use_fast_model=False` (escalate to primary). Pass `extra_instruction` retry prompt as today.
- Adjust `extract()` to accept optional `force_primary_model: bool = False` kwarg overriding the flag for the retry path only.

### Rollout plan
- Ship behind flag, default off in prod.
- Enable for 10% of users for 1 week, monitor `pipeline.extraction_quality` log scores.
- If green, flip default on.

### Acceptance criteria
- Eval harness completes on 100-video sample, generates JSON report.
- Quality delta < 0.05 average; no domain regresses > 10%.
- Flag-on extractions retry to primary model on hard-miss low-score cases.
- Flag-off behavior is byte-identical to pre-merge baseline.

### Tests
- Existing extraction tests run with both flag values.
- New test: retry escalates from fast model to primary when triggered.

### Effort: XL (3–5 days incl. eval harness build + eval run + rollout monitoring)

---

## End-to-End Verification

After all phases ship, re-run the original Matt Pocock livestream and confirm:

### 1. Cost
Admin dashboard shows new totals:
- frames: ~$0.005 (was $0.034) on fast model
- chapter_detect: ~$0.002 (was $0.011) on fast model, correctly tagged
- extraction (call 1): ~$0.02 on fast model (P2 enabled) or ~$0.20 on primary
- extraction retry: **does not run** (livestream + has_narrative skips hard-miss)
- **Total: ~$0.05–0.13** down from $0.494 (~75–90% reduction)

### 2. UX
Watching the stream, frontend shows:
- `Extracting batch 1/4…` → `2/4…` → `3/4…` → `4/4…` → `Polishing the response…`
- Wall time from extraction start to enrichment: ~60s instead of ~330s (parallel); ~120–160s with sequential fallback if rate-limited.

### 3. Dedup
Refresh the page during a running pipeline:
- Frontend reads cached `videosApi.getById(:id)` first, sees `status=PROCESSING`, opens `/stream`.
- Summarizer logs `Attaching as additional consumer` (not `producer_lock_acquired`).
- No duplicate pipeline cost; single producer continues to completion.

### 4. Cache
Admin dashboard shows `cache_read_tokens` populated for repeat extractions; `cost_usd` reflects discount.

### Test commands

```bash
# Backend tests
cd services/summarizer && python3 -m pytest \
  tests/test_extraction_quality.py \
  tests/test_extractor.py \
  tests/test_chunked_extraction.py \
  tests/test_frame_analyzer.py \
  tests/test_transcript_chunker.py -v

# llm_common tests
cd packages/llm-common && python3 -m pytest tests/test_callback.py -v

# API tests
cd api && npm test -- src/routes/videos.routes.test.ts

# Web tests
cd apps/web && npm test -- features/video-output/lib/streaming features/video-output/components/VideoIntakeForm

# E2E
npm run test:e2e -- e2e/cooking-mode.spec.ts e2e/all-domains.spec.ts

# Eval harness (P2 only)
python3 scripts/eval_extraction_models.py --sample-size=100 --output=eval_report.json

# Live smoke test
docker-compose up -d
# In browser: paste a 60+ min livestream URL, watch progress, verify cost in admin
```

---

## Risk Assessment & Mitigation

| Risk                                                                    | Likelihood | Impact | Mitigation                                                                                          |
|-------------------------------------------------------------------------|------------|--------|-----------------------------------------------------------------------------------------------------|
| Fast-model vision quality regression on dense-text frames               | Medium     | Medium | Spot-check 5 frames before merging P3; env override `LLM_FAST_MODEL=anthropic/claude-haiku-4-5-20251001` |
| LiteLLM cache crediting works correctly already (audit shows nothing)   | Medium     | Low    | Step 1 is read-only; ship logs first, decide on fix scope after data                                |
| Force-split breaks for unusual transcripts (no sentence boundaries)     | Low        | Medium | Triple fallback chain: chunks → force-split → overflow as last resort                              |
| Rate-limit fallback masks genuine downstream outages                    | Low        | Low    | Explicit `chunked-sequential` SSE event makes fallback visible to operators                         |
| P2 corpus eval shows quality regression; can't ship                     | Medium     | None   | Ship is gated on eval; this is the protective design, not a risk                                    |
| Frontend dedup race: getById in-flight when page mounts                 | Low        | Low    | React Query already caches; on cache miss, fall through to current behavior                         |
| Stale `PROCESSING` records after summarizer crash                       | Low        | Low    | Out of scope; existing lock TTL handles eventually. Track as separate bug if observed.              |
| New retry-gate too aggressive, hides genuine quality regressions        | Low        | Medium | Score gate (>=0.7) + format gate are both required; low-score path unchanged                        |

---

## Dependencies

- **Internal:** classifier phase populates `ctx.content_format` and `ctx.content_traits` before extraction (already true per memory).
- **Internal:** Redis lock infrastructure in summarizer is correct as-is (no changes needed).
- **Internal:** `videosApi.getById(id)` returns `status` field already (no backend change needed for dedup).
- **External:** `gpt-4o-mini` vision quality acceptable for OCR/captioning (verify in P3 spot-check).
- **External:** LiteLLM correctly parses `cache_creation_input_tokens` / `cache_read_input_tokens` from Anthropic responses (verify in P4 diagnose step).
- **External:** Anthropic 529 (overloaded) and 429 (rate-limit) both surface as classifiable exceptions in `services/summarizer/src/utils/llm_retry.py` (verify in P1).

---

## Success Metrics

| Metric                                          | Baseline | Target           | Measurement                              |
|-------------------------------------------------|----------|------------------|------------------------------------------|
| Per-video extraction cost (livestream, 108 min) | $0.494   | $0.05–0.13       | admin dashboard cost row                 |
| Wall time from extraction start → enrichment    | ~330s    | ~60s (parallel)  | SSE event timestamp diff                 |
| Duplicate pipeline triggers per refresh         | 1 per refresh on COMPLETED | 0           | summarizer log grep `producer_lock_acquired` |
| User-visible per-batch progress                 | None     | `1/4` → `2/4` etc | manual UI verification                  |
| Cache savings visible in admin                  | Not tracked | tracked       | UsageRecord `cache_read_tokens > 0` on repeat |
| Hard-miss retry trigger rate on narrative formats | ~100% (bug) | ~0%        | log grep `hard miss on` for narrative formats |

---

## Open Questions / Verification Notes

1. **Fast-model vision quality on dense-text frames** — `gpt-4o-mini` handles vision reliably for general OCR/captioning, but verify on 5 sample frames before merging P3. If a domain regresses, override `LLM_FAST_MODEL=anthropic/claude-haiku-4-5-20251001` via env (no code change).
2. **`livestream` format value** — not in classifier's `VALID_FORMATS`. Trait-based check (`has_narrative`/`is_opinionated`) covers the missing case, but consider adding `livestream` to `VALID_FORMATS` for clarity.
3. **LiteLLM cache crediting** — diagnose-then-fix; behavior depends on LiteLLM version and model entry. Step 1 of P4 is read-only and definitive.
4. **Rate-limit error class** — confirm whether the LLM provider raises a distinct exception type for 529 (overloaded) vs 429 (rate-limit), or whether both surface as `litellm.RateLimitError`. P1 fallback should catch both. Verify against `services/summarizer/src/utils/llm_retry.py`.
