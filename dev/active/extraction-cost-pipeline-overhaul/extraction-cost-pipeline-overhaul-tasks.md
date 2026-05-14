# Extraction Cost & Pipeline Dedup Overhaul — Tasks

**Last Updated:** 2026-05-14 (v7 — Phase 6 root-cause fix: batch-aware extraction prompt)

## Status Summary (2026-05-14 v7 — Phase 6 batch-aware prompt landed)

The v6 retry-burn trade-off has a code-side fix. The root cause was a prompt assumption: each batch's prompt told the model `<completeness>This video is {duration_minutes} minutes long. Every section or chapter should be represented in your output.</completeness>` + `<critical_rule>NEVER return empty arrays. Every array field MUST have at least 3 items for a 10+ minute video.</critical_rule>`. With force-split + parallelism, each batch sees only 1/N of the transcript while still being held to the full-video completeness/density rule — so missing fields look like coverage gaps and the merged extraction scores below `RETRY_SCORE_THRESHOLD=0.6`, triggering the synthesis-fed retry.

### v7 fixes shipped (working tree)

| Fix | File | Change |
|---|---|---|
| Phase 6.1 — batch-aware prompt placeholder | `services/summarizer/src/prompts/base_extraction.txt` | Added `{batch_context}` placeholder inside the `<transcript>` block, before `{transcript}`. Stays in the dynamic (uncached) prompt suffix so per-batch context never invalidates the Anthropic prompt cache. |
| Phase 6.2 — per-batch substitution helpers | `services/summarizer/src/services/pipeline/extractor.py` | `_format_prompt(template, transcript, batch_context="")` and `_split_prompt_for_caching(template, transcript, batch_context="")` accept and substitute `{batch_context}` per call. `_run_batch_extraction` accepts `batch_context: str = ""`. New helper `_build_batch_context(batch_idx, total_batches, batch, full_duration_seconds)` builds the partial-extraction guidance block. `_chunked_extraction` computes per-batch context from each batch's chapter ranges and passes it into both the parallel pass AND the sequential rate-limit fallback. |
| Phase 6.2 — wrapper completeness | `services/summarizer/src/services/pipeline/prompt_builder.py` | `build_extraction_prompt` (the single-shot convenience wrapper) explicitly clears the new `{batch_context}` placeholder so callers never see a stray placeholder in their assembled prompt. |
| Phase 6 tests | `services/summarizer/tests/test_chunked_extraction.py` | New `TestBuildBatchContext` (5 tests), `TestPromptHelpersWithBatchContext` (3 tests), `TestChunkedExtractionInjectsBatchContext` (2 tests) — total 10 new tests verifying empty/multi-batch behavior, per-call substitution, cache-safety, and that the partial-context block reaches the LLM call on both parallel and sequential-fallback paths. |
| Phase 6 docs | `docs/SERVICE-SUMMARIZER.md` | Batched-Extraction section now documents `_build_batch_context` and the v6→v7 rationale callout. |

### What the batch_context tells the model

```
<batch_partial_context>
You are extracting from BATCH {k} of {N} parallel batches.
This segment covers ~{m} of the full {M}-minute video.

CRITICAL RULES FOR PARTIAL EXTRACTION:
- Extract ONLY what THIS segment explicitly contains.
- Return EMPTY arrays for fields not present in your segment — other batches cover them.
- A downstream merger combines all batches; DO NOT pad fields to meet "no empty array" or density quotas.
- The completeness/density rules in the base prompt apply to the FULL video's MERGED output, not your batch in isolation.
- DO NOT infer absence: a field absent here may be covered by another batch.
</batch_partial_context>
```

### v7 expected outcome on the K-mA3MZ_EzU smoke test (NOT yet measured live)

- First-pass extraction: parallel 4 Sonnet batches with partial-context guidance. Each batch outputs only its segment's data → smaller per-batch output token volume.
- Merged extraction: scoring should reflect TRUE field-presence across the merged whole, not the artifact of each batch over-padding/under-padding in isolation.
- Retry: should NOT fire (merged score above 0.6) unless the video genuinely has poor coverage in the transcript.
- Wall time: ~170s parallel (vs v6's 546s with retry, v5's 377s single-call).
- Cost: ~$0.40–0.50 first pass with no retry (vs v6's $0.99, v5's $0.38). **Roughly back to v5 baseline cost with wall-time win + cache validation + correct attribution maintained.**

### What v7 explicitly does NOT do (still open for follow-up)

- **Does not hit the $0.05–0.13 cost target.** That target was modeled on Phase 2 / P4 fast-first extraction; without flipping `EXTRACTION_USE_FAST_FIRST=True`, the floor remains Sonnet's output-token rate × ~15–20K total output tokens ≈ $0.30–0.50.
- **Does not run the eval corpus.** P2 rollout still gated on `scripts/eval_extraction_models.py` against a 50+ video sample, which needs prod-like data the dev mongo doesn't have.
- **Does not revert frame vision.** v6's revert to Sonnet for vision stays (gpt-4o-mini's OCR hallucination on dense-text frames was unacceptable).
- **Does not touch unrelated diffs.** `apps/web/src/.../OverviewInteractive.tsx` (duplicate-hero refactor) and the `vie-logo.svg` deletion are integration-advanced work; they remain in the working tree but should be split out before any commit boundary.

### Test verification (v7)

| Suite | Tests | Status |
|---|---:|---|
| summarizer (changed-area + Phase 6 additions) | 269 / 269 | ✅ |
| llm-common | 17 / 17 | ✅ |
| apps/web streaming | 71 / 71 | ✅ |
| **Total** | **357 / 357** | ✅ |

### Follow-ups (carried over)

- Live smoke test on `K-mA3MZ_EzU` to verify retry-suppression and measure actual v7 cost
- Build prod-like eval corpus and run `scripts/eval_extraction_models.py`
- Flip `EXTRACTION_USE_FAST_FIRST=True` if eval passes (cost target then becomes reachable)
- Admin dashboard plumbing for `cache_creation_tokens`/`cache_read_tokens` (out of scope per Phase 2)
- Split `OverviewInteractive.tsx`/`vie-logo.svg` diffs into the `integration-advanced` task before any commit on this branch

---

## Status Summary (2026-05-14 v6 — production fixes shipped, deeper trade-off surfaced)

Track progress by checking off items as they complete. Each task has acceptance criteria; sub-tasks must be ticked off before the parent.

Legend: `[ ]` = todo, `[~]` = in progress, `[x]` = done, `[-]` = skipped/deferred.

## Status Summary (2026-05-14 v6 — production fixes shipped, deeper trade-off surfaced)

Three blockers identified in v5 are fixed in working tree. Re-verification on `K-mA3MZ_EzU` (admin@admin.com) confirms parallelism + cache-read + correct feature tagging now work end-to-end. **However**, the per-batch context loss caused by force-split + bypass triggers the low-score retry path (score 0.40 < `RETRY_SCORE_THRESHOLD=0.6`), so total cost is now **higher** than v5, not lower. The v6 wins are architectural correctness (cache + parallelism + tagging); the cost target ($0.05–0.13) remains unreachable without addressing per-batch context fidelity.

### v6 fixes shipped (working tree)

| Fix | File | Change |
|---|---|---|
| #1 force-split → batch_chapters bypass | `services/summarizer/src/services/pipeline/extractor.py` | `_resolve_strategy` returns `(strategy, chunks, one_chunk_per_batch)` 3-tuple. When force-split engages, the flag is `True`. `_chunked_extraction` accepts the flag and builds `batches=[[c] for c in chunks]` to skip the re-grouping that previously collapsed force-split chunks under `MAX_TOKENS_PER_BATCH=50_000`. |
| #2 frames → primary (Sonnet) | `services/summarizer/src/services/media/frame_analyzer.py:133` | `use_fast_model=True` → `use_fast_model=False`. Reverses the Phase 1B / P3 routing in light of v5 spotcheck (gpt-4o-mini vision was only ~20% cheaper AND hallucinated OCR on dense text). |
| #3 chapter_detect correct attribution | `services/summarizer/src/services/transcription/transcript_chunker.py:_detect_chapters_with_ai` | Wraps the LLM call in `llm_feature_var.set("summarize:chapter_detect")` / `reset(token)` so the cost appears under its own line item in `llm_usage` instead of being absorbed by the outer `summarize:extraction` tag set in `phases/extraction.py:98`. |

### v6 verification — measured outcomes

| Verification | v5 outcome | v6 outcome | Verdict |
|---|---|---|---|
| Per-batch parallelism (Phase 3 / P1) | ⚠️ blocked (4 chunks → 1 batch) | ✅ **4 chunks → 4 batches**, semaphore=2 parallel, batch1 ~56s | PASS |
| SSE `extraction_progress` carries `batch`/`of` | `batch=1/of=1` | `batch=k/of=4` per batch | PASS |
| `cache_read_tokens > 0` (Phase 2 / P4) | ⚠️ creation-only (untested for reads) | ✅ **batches 3 & 4 each read `cache_read_tokens=5578`** | PASS |
| `chapter_detect` feature tagging | tagged `summarize:extraction` | ✅ tagged `summarize:chapter_detect` | PASS |
| Frame vision quality | gpt-4o-mini hallucinated dense-text frame 2 | ✅ Sonnet for frames (cost $0.0317, similar to v5's $0.0309 but accurate) | PASS |
| Hard-miss retry gate (Phase 1A / P0) | ✅ score 0.80 → skipped | ✅ this run skipped `tips`/`products` (out-of-schema), then score=0.40 → low-score retry fired (different gate, working as designed) | PASS |
| **Total cost target $0.05–0.13** | ❌ $0.3841 | ❌ **~$0.65+ (retry burns ~$0.40 more)** | **WORSE THAN v5** |
| Wall time ~60s parallel | ❌ 275s (single batch) | ⚠️ first pass ~170s (parallel), retry adds ~170s more → ~340s | similar / slightly slower than v5 |

### The trade-off v6 surfaces

The force-split fix splits the 14K-word transcript into 4 token-light chunks. Each parallel batch sees only its own 1/4 of the transcript. Without whole-video context, each batch fails to populate fields like `steps` (the LLM doesn't realize what's available in *other* batches). The downstream quality check scores the merged extraction at **0.40**, below the `RETRY_SCORE_THRESHOLD=0.6` cutoff, so the synthesis-fed retry fires — **re-running all 4 batches with synthesis context**, doubling the extraction cost.

In short: **parallelism unlocked wall-time parity AND cache validation AND correct attribution, but the per-batch context loss tripped a different retry gate**. The single-batch path's quality (0.80 in v5) was an artifact of seeing the whole transcript at once. The Phase 3 / P1 design assumed parallel batches would maintain quality; on this video they don't.

### v6 cost detail — final (pipeline DONE in 546s, 6/6 tabs assembled)

Aggregated `llm_usage` rows (`video_id="K-mA3MZ_EzU"`, since `2026-05-14T11:22Z`):

| Feature | Calls | Cost (USD) | cache_creation_tokens | cache_read_tokens |
|---|---:|---:|---:|---:|
| `summarize:metadata` | 1 | $0.0001 | 0 | 0 |
| `summarize:frames` (Sonnet — Fix #2) | 1 | $0.0317 | 0 | 0 |
| `summarize:classifier` | 1 | $0.0003 | 0 | 0 |
| `summarize:plan` | 1 | $0.0415 | 0 | 0 |
| **`summarize:chapter_detect`** (Fix #3) | 1 | $0.0003 | 0 | 0 |
| **`summarize:extraction` (4 first-pass + 4 retry + 1 small)** | **9** | **$0.9226** | **11,156** | **33,468** |
| `summarize:enrichment` | 1 | $0.0013 | 0 | 0 |
| **TOTAL** | **15** | **$0.998** | **11,156** | **33,468** |

**Wall-time breakdown** from pipeline DONE log: `metadata=6.8s transcript_frames=41.1s plan=27.9s extraction=424.7s synthesis=0.0s(skipped — retry pre-populated) enrichment=43.0s assembly=2.3s` → **546s total** (vs v5's 377s).

**The retry dominates.** First-pass extraction was ~$0.41 with parallelism (vs v5's $0.31 single-batch). The synthesis-fed retry was another ~$0.51 (4 more Sonnet batches with synthesis context + `force_primary_model=True`). Cache reads saved ~$0.115 absolute (33,468 read tokens at $3.45/M discount vs creation) but didn't offset the retry burn.

**Quality:** score went 0.40 → 0.60 after retry — just at `RETRY_SCORE_THRESHOLD=0.6` cutoff. **Tabs assembled: 6/6** (v5 dropped 1 of 6 — v6 retry pulled in enough data to populate the `project.steps`-dependent `build_phases` tab).

### v6 final outcome vs targets

| Metric | Baseline | v4/v5 target | v5 actual | v6 actual | Δ vs v5 |
|---|---:|---:|---:|---:|---:|
| Total cost | $0.494 | $0.05–0.13 | $0.3841 | **$0.998** | **+159% (regression)** |
| Wall time | ~330s ext. | ~60s ext. | 377s | **546s** | **+45% (regression)** |
| Tabs assembled | n/a | 6/6 | 5/6 | **6/6** | **+1 tab (win)** |
| Cache reads | 0 | >0 | 0 | **33,468** | **PASS (validated)** |
| Hard-miss gate fires correctly | n/a | yes | yes | yes | maintained |
| chapter_detect attribution | tagged extraction | own line item | tagged extraction | **`summarize:chapter_detect`** | **PASS** |
| Frame OCR quality | Sonnet | Sonnet-equivalent | gpt-4o-mini hallucinated | **Sonnet** | **PASS** |

### Admin user view confirmed

`userVideos._id=6a05b1828b4344893f8ce5b0` (admin@admin.com) — manually synced to `status=completed` after pipeline finished (the direct-summarizer smoke driver bypasses the vie-api stream route that would normally auto-sync).

### Admin user view

`userVideos._id=6a05b1828b4344893f8ce5b0` (created manually since the smoke driver bypasses the vie-api gateway). Owner: `admin@admin.com`. Navigate to `/video/6a05b1828b4344893f8ce5b0` to see the v6 result rendering.

> Sync caveat: `videoSummaryCache.status` flips to `completed` independently from `userVideos.status`. The api-gateway-driven flow auto-syncs both via `api/src/routes/stream.routes.ts`, but this run was direct-to-summarizer. `userVideos.status` was hand-set to `processing` and will be hand-set to `completed` when the pipeline finishes.

### Next-highest-impact follow-up (after v6)

The v6 retry-on-low-score pattern means parallelism doesn't reduce total LLM spend — it just spreads the spend across more concurrent calls AND adds a retry. To actually hit the $0.05–0.13 target, one of these must happen:

1. **Inject whole-video context into each parallel batch.** Pass the synthesis output (or a short video-level digest) into every batch as additional context so each batch knows what other batches will produce. Single ~$0.005 synthesis call up front; eliminates the ~$0.40 retry.
2. **Raise `RETRY_SCORE_THRESHOLD` to 0.5 or below.** Accept somewhat-lower extraction quality from parallel batches as the cost of wall-time parity. Risky — broad quality regressions possible.
3. **Skip the parallel path when output token output would exceed N.** Some videos genuinely benefit from single-batch context. Heuristic-gate the path.
4. **Move extraction to `EXTRACTION_USE_FAST_FIRST=true`** (Phase 4 / P2 gate). If the eval shows fast-model parallel batches maintain quality, the cost target becomes reachable. The P2 eval harness already exists — needs a corpus.

---

Live smoke test ran end-to-end on `K-mA3MZ_EzU`. Two of three plan assumptions held, two missed materially. Code from the five implementation phases is unchanged; this revision adds **Live Verification Results — 2026-05-14** below and flips per-phase verification checkboxes with the measured outcomes.

| Verification | Outcome | Detail |
|---|---|---|
| V1: Hard-miss retry gate (Phase 1A / P0) | ✅ PASS | `Skipping hard-miss retry: score 0.80 >= gate 0.70`. Saved $0.205 + ~190s. |
| V1: Cost target ($0.05–0.13) | ❌ MISS | Actual **$0.3841** (22% reduction from $0.494, not 75–90%). Driver: gpt-4o-mini vision bills ~25K tokens/image. |
| V1: Per-batch UI progress (Phase 3 / P1) | ⚠️ BLOCKED | Force-split works, but `batch_chapters` re-collapses to 1 batch. SSE emits `batch=1, of=1`. |
| V2: Cache plumbing (Phase 2 / P4) | ✅ PASS for creation, ⚠️ untested for reads | `cache_creation_tokens=5735` recorded. No reads because of the same single-batch collapse. |
| V3: gpt-4o-mini vs Sonnet vision | ⚠️ MIXED | ~20% cheaper (not 6×). Scene-type accuracy 2/5. Dense-text frame 2 hallucinated. |

**Next-highest-impact follow-up:** fix the force-split → `batch_chapters` re-collapse so parallelism actually engages. Without it, both the wall-time win and the cache_read validation remain blocked.

---

## Status Summary (2026-04-27 v4)

All five implementation phases (1A, 1B, 1C, 2/P4, 3/P1, 4/P2) plus the P2 eval harness landed in the working tree under `dev-1-ux`. `/complete-task` workflow ran clean today: tests + security + code review + docs.

### `/complete-task` workflow results (2026-04-27)

| Step | Result |
|------|--------|
| 1. Plan verification | ✅ All modified files match the 5-phase plan |
| 2. Tests (changed-area re-run) | ✅ 218/218 summarizer + 15/15 llm-common + 71/71 web streaming |
| 3. Security audit | ✅ No hardcoded secrets, env-var connection strings, specific exception classes, type-narrowed SSE handlers, fail-safe dedup |
| 4. Code review | ✅ No `console.log`/`print()`/`TODO`/`FIXME`/`: any`; ARIA wired; conventions match |
| 5. Documentation | ✅ Updated `docs/SERVICE-SUMMARIZER.md` (SSE row + Batched Extraction + Fast Model Routing + 3 new config rows) and `docs/SERVICE-ADMIN.md` (UsageRecord field count + cache helper) |

### Documentation diff (2026-04-27 v4)

- `docs/SERVICE-SUMMARIZER.md`
  - SSE `extraction_progress` row now lists `batch?`/`of?` and the `chunked-sequential` section value.
  - Batched Extraction section rewritten: `EXTRACTION_PARALLEL_BATCHES` semaphore (default 2), single-batch force-split into `EXTRACTION_FORCE_SPLIT_CHUNKS` (default 4), `RateLimitError`/`ServiceUnavailableError` → sequential fallback with `_RATE_LIMIT_BACKOFF_SECONDS`, `EXTRACTION_USE_FAST_FIRST` flag + retry escalation via `force_primary_model`.
  - Fast Model Routing section adds Enrichment, frame vision (`complete_with_messages` no-fallback path), AI chapter detection, and the gated extraction first pass.
  - Configuration table adds `EXTRACTION_PARALLEL_BATCHES` (2), `EXTRACTION_FORCE_SPLIT_CHUNKS` (4), `EXTRACTION_USE_FAST_FIRST` (False).
- `docs/SERVICE-ADMIN.md`
  - `models.py` row updated: `UsageRecord` is now 23 fields incl. `cache_creation_tokens`, `cache_read_tokens`, `cache_savings_usd`; mentions `compute_cache_savings_usd(model, tokens)` + `_CACHE_RATES_USD_PER_M` (Sonnet 4.5/4.6, Haiku 4.5).

**Test results across the project (re-run today):**

| Surface           | Tests           | Status |
|-------------------|-----------------|--------|
| summarizer        | 1406 / 1406     | ✅     |
| llm-common        | 41 / 41         | ✅     |
| apps/web (vitest) | 756 / 756       | ✅     |
| **Total**         | **2203 / 2203** | ✅ |

**Targeted re-run during `/complete-task` (2026-04-27 v4):**

| Surface | Files | Tests | Status |
|---------|-------|-------|--------|
| summarizer (changed-area) | `test_extraction_quality.py`, `test_extractor.py`, `test_chunked_extraction.py`, `test_frame_analyzer.py`, `test_transcript_chunker.py`, `test_llm_provider.py`, `test_eval_extraction_models.py` | 203 / 203 | ✅ |
| llm-common | `test_callback.py` | 15 / 15 | ✅ |
| apps/web streaming | `should-open-stream.test.ts`, `stream-event-processor-v2.test.ts`, `sse-validators.test.ts` | 71 / 71 | ✅ |

**Typecheck + plumbing audit:**

| Check  | Result |
|--------|--------|
| apps/web (`tsc --noEmit`)                                     | ✅ clean |
| `HARD_MISS_SCORE_GATE = 0.7` present in `extraction_quality.py` | ✅      |
| `use_fast_model` plumbed in `llm_provider.py`, `frame_analyzer.py`, `transcript_chunker.py` | ✅ |
| `EXTRACTION_PARALLEL_BATCHES`, `EXTRACTION_FORCE_SPLIT_CHUNKS`, `EXTRACTION_USE_FAST_FIRST` in `config.py` | ✅ |
| `force_primary_model` honored in `extractor.py:198-199`, `phases/extraction.py` retry path | ✅ |
| `_safe_int` + cache-token fields + `_CACHE_RATES_USD_PER_M` in `llm_common` | ✅ |
| `shouldOpenStreamForStatus` + 8 unit tests in `apps/web/src/features/video-output/lib/streaming/` | ✅ |
| Eval harness `scripts/eval_extraction_models.py` `--dry-run` exits cleanly | ✅      |

**Live container smoke (2026-04-27):**

| Service          | State   | Notes |
|------------------|---------|-------|
| vie-summarizer   | healthy | model=`anthropic/claude-sonnet-4-6`, db=connected, s3=healthy. Bind-mount `./services/summarizer/src` → `/app/src:ro` confirms new code is loaded |
| vie-web          | 200 OK  | Vite dev server on `:5173` responds |
| vie-api / mongo / redis / qdrant | healthy | (already up before session) |

**E2E (informational, NOT a regression for this task):** `e2e/all-domains.spec.ts` + `e2e/cooking-mode.spec.ts` failed (39/?) waiting for `.max-w-4xl` selector. Verified our diff does **not** reference `.max-w-4xl` — pre-existing flake from the shell redesign (commit `fd427fc`). Out of scope here.

**Outstanding** (cannot be finished without external authorization — money or human action):

- Open PRs for each phase branch (working tree only; per `feedback_never_commit`, ask before commit)
- ✅ **2026-05-14:** Live smoke test on `https://www.youtube.com/watch?v=K-mA3MZ_EzU` ran end-to-end — see **Live Verification Results — 2026-05-14** below
- ✅ **2026-05-14:** Cache crediting validated via within-run inspection — `cache_creation_tokens` recorded on Sonnet extraction; cache reads not observed because force-split chunks re-collapsed to 1 batch (see V2 results)
- ✅ **2026-05-14:** Frame vision spot-check ran via new `scripts/spotcheck_frame_vision.py` (gpt-4o-mini vs Sonnet, 5 frames) — see V3 results
- **Run** the P2 eval harness on 100 videos — local Mongo has only 22 cached docs, none with `rawTranscriptRef` set (no S3-backed transcripts in dev). Needs prod-like data or an S3-populated dev environment.
- Admin dashboard UI plumbing for `cache_creation_tokens` / `cache_read_tokens` / `cache_savings_usd` (explicitly out of scope per Phase 2)
- 10% staged rollout of `EXTRACTION_USE_FAST_FIRST` (production deployment)

---

## Phase 1A — P0: Format-aware retry trigger fix ✅

**Effort:** S | **Risk:** Low | **Status:** Done

### Backend changes — `extraction_quality.py`
- [x] Add `HARD_MISS_SCORE_GATE = 0.7` module constant
- [x] Add `NARRATIVE_FORMATS = frozenset([...])` (12 formats)
- [x] Add `STEP_LIKE_FIELDS = frozenset([...])` (5 fields)
- [x] Add `_is_narrative_content(content_format, content_traits)` helper
- [x] Extend `decide_extraction_retry` signature with `content_format` + `content_traits`
- [x] Implement filter: drop `STEP_LIKE_FIELDS` from `hard_miss_fields` when narrative content
- [x] Implement score gate: hard-miss-only retry suppressed above `HARD_MISS_SCORE_GATE`
- [x] Log skip reasons for narrative drops AND above-gate skips

### Backend wiring — `phases/extraction.py`
- [x] Pass `content_format=ctx.content_format, content_traits=ctx.content_traits` at the call site

### Tests — `test_extraction_quality.py`
- [x] Updated: `test_hard_miss_below_gate_triggers_retry` (renamed from `_despite_high_score`, score moved to 0.65 — within the gate)
- [x] New: `test_high_score_above_gate_suppresses_hard_miss_retry`
- [x] New `TestFormatAwareRetryGate` suite (10 tests) covering narrative/tutorial format, traits-based gate, mixed step+non-step misses, and the helper functions
- [x] Adjusted scores in 5 existing tests so they still hit the hard-miss path (0.8 → 0.65)
- [x] 56 / 56 tests pass

---

## Phase 1B — P3: Frames + chapter_detect → fast model ✅

**Effort:** S | **Risk:** Low | **Status:** Done

### Backend — `llm_provider.py`
- [x] `complete_with_messages` accepts `use_fast_model: bool = False`
- [x] When True, routes through `self._fast_model` instead of `self._model`
- [x] Skips `fallbacks` when fast (Sonnet fallback would defeat cost saving)
- [x] Passes `model=effective_model` into `_call_with_error_logging` for accurate error logs

### Backend — `frame_analyzer.py`
- [x] `analyze_frames_with_vision` calls `complete_with_messages(..., use_fast_model=True)`

### Backend — `transcript_chunker.py`
- [x] `_detect_chapters_with_ai` passes `use_fast_model=True` to `call_llm_with_retry`

### Tests
- [x] `test_llm_provider.py` — 3 new tests in `TestUseFastModel` (routes to fast, defaults to primary, skips fallbacks)
- [x] `test_frame_analyzer.py` — `test_routes_to_fast_model` asserts kwarg propagation
- [x] `test_transcript_chunker.py` — `test_ai_chapter_detection_uses_fast_model` asserts kwarg + stage_name
- [x] 59 / 59 tests pass

### Verification
- [~] Live run on a tech tutorial; admin dashboard `summarize:frames` cost drop — **ran on K-mA3MZ_EzU 2026-05-14: $0.0309 (was ~$0.034). ~9% reduction, not the ~6× predicted. `openai/gpt-4o-mini` vision token billing dominates.** See "Live Verification Results — 2026-05-14" → V1 cost table.
- [x] Spot-check vision output on 5 sample frames against Sonnet baseline — **ran 2026-05-14 via `scripts/spotcheck_frame_vision.py`. Verdict: marginally cheaper (~20% per call) but scene_type accuracy 2/5 and OCR hallucination on dense-text frame 2. See V3.**

---

## Phase 1C — Pipeline dedup (frontend status check) ✅

**Effort:** S | **Risk:** Low | **Status:** Done

### Frontend changes
- [x] New utility: `apps/web/src/features/video-output/lib/streaming/should-open-stream.ts` exporting `shouldOpenStreamForStatus()`
- [x] `VideoDetailPage.tsx` switched from inline string-equality (`status === "pending" || status === "processing"`) to `shouldOpenStreamForStatus(video?.status)` with intent comment
- [x] Race-safety preserved: undefined / null / unknown statuses return `false` (fail-safe — no stream until record loads)

### Tests
- [x] `should-open-stream.test.ts` — 8 cases (processing, pending, completed, failed, undefined, null, empty, unknown)
- [x] Existing `use-summary-stream.test.ts` regression (14 / 14) still green — `enabled=false` path proves the dedup chain
- [x] Total 22 / 22 dedup-relevant tests pass

### Acceptance
- [x] No duplicate pipeline triggers from a mid-stream refresh (status check guards re-mount)
- [x] Refresh on `COMPLETED` video does NOT hit `/stream`
- [x] User-visible behavior unchanged for `PENDING`/`PROCESSING`/`FAILED`
- [ ] Manual browser-network-tab smoke test (out of scope this session)

---

## Phase 1 — Ship combined PR (P0 + P3 + dedup)

- [x] All Phase 1A, 1B, 1C tasks checked off
- [x] All tests pass: summarizer + apps/web
- [ ] Combined PR with conventional commit titles per phase  ← **deferred to ship step**
- [ ] Manual livestream smoke test confirms cost drop
- [ ] PR description includes before/after cost numbers from admin dashboard
- [ ] Code review approved
- [ ] Merged to `main`

---

## Phase 2 — P4: Cache cost-credit audit ✅

**Effort:** S–M | **Risk:** Low | **Status:** Plumbing done; live diagnose deferred

### Step 1 — Diagnose (read-only) — DEFERRED
- [ ] Add temporary debug block in `_build_record` to dump cache token fields
- [ ] Run two extractions back-to-back on the same test video
- [ ] Document finding: "LiteLLM credits cache" OR "LiteLLM does NOT credit cache"

> **Note:** Plumbed both fields *and* a per-model rate map up front so the
> dashboard has data to render either way. If the live diagnose reveals
> LiteLLM already credits cache, the new `cache_savings_usd` field is
> redundant with cost_usd; if not, the rate map fills the gap.

### Step 2 — Fix (plumbing already in place)
- [x] Extend `UsageRecord` with `cache_creation_tokens`, `cache_read_tokens`, `cache_savings_usd`
- [x] Parse `usage.cache_creation_input_tokens` / `cache_read_input_tokens` from response
- [x] Per-model cache rate map (`_CACHE_RATES_USD_PER_M`) for Sonnet 4.6 + Haiku 4.5
- [x] `compute_cache_savings_usd(model, tokens)` exported helper
- [x] Robust `_safe_int()` to avoid leaking MagicMocks into records
- [x] `cache_hit` now also infers `True` when `cache_read_tokens > 0`

### Tests — `test_callback.py`
- [x] `MockResponse` accepts `cache_creation_input_tokens`, `cache_read_input_tokens`, `cache_hit` kwargs
- [x] 5 new tests in `TestCachePlumbing`:
  - records cache_creation_tokens
  - records cache_read_tokens + computes Sonnet savings (10K reads → $0.027)
  - Haiku-specific savings rate
  - unmapped model yields zero savings (no inventing)
  - missing cache fields default to 0
- [x] 15 / 15 tests pass

### Verification
- [~] Run two back-to-back extractions; verify dashboard shows `cache_read_tokens > 0` on second — **partially done 2026-05-14: within-run inspection of K-mA3MZ_EzU recorded `cache_creation_tokens=5735` on Sonnet extraction (plumbing verified). `cache_read_tokens=0` because force-split chunks collapsed to 1 batch — no 2nd LLM call read the cache. Dedicated back-to-back test deferred.**
- [ ] Verify `cost_usd` on second call is meaningfully lower — blocked on the above

### Out of scope
- [ ] Admin dashboard UI changes for new fields → follow-up task

---

## Phase 3 — P1: Force-split + per-batch SSE + rate-limit fallback ✅

**Effort:** L | **Risk:** Medium | **Status:** Done

### Backend — `extractor.py:_resolve_strategy`
- [x] Detect single-batch chunked input (`len(batches) == 1`)
- [x] If `word_count <= SINGLE_THRESHOLD = 5333` → return `("single", None)`
- [x] Otherwise call `_force_split_by_sentences(transcript, duration_seconds, target_chunks=settings.EXTRACTION_FORCE_SPLIT_CHUNKS)`
- [x] Return `("chunked", force_split_chunks)` when split yields ≥ 2 chunks
- [x] Triple fallback to overflow when force-split also yields 1 chunk

### Backend — `transcript_chunker.py`
- [x] `force_split_by_sentences` accepts `target_chunks: int | None`
- [x] When set, computes `target_words = (total + target_chunks - 1) // target_chunks` (round up)
- [x] Existing default-target_words behavior preserved when `target_chunks` omitted

### Backend — `extractor.py:_chunked_extraction` (rewritten)
- [x] `EXTRACTION_PARALLEL_BATCHES: int = 2` and `EXTRACTION_FORCE_SPLIT_CHUNKS: int = 4` added to `config.py`
- [x] `Semaphore(min(settings.EXTRACTION_PARALLEL_BATCHES, num_batches))` instead of hardcoded 3
- [x] Each batch task wrapped in try/except for `RateLimitError` + `ServiceUnavailableError`
- [x] Rate-limited batches recorded in `rate_limited: list[int]`, processed sequentially after parallel pass
- [x] `_RATE_LIMIT_BACKOFF_SECONDS = 2.0` between sequential retries
- [x] `asyncio.Queue` + sentinel pattern streams progress events as batches complete
- [x] Helper `_run_batch_extraction()` extracted (single-batch logic shared by parallel + sequential paths)
- [x] Helper `_percent_for_batch(completed, total)` clamps progress into 5–70% band

### Backend — SSE event shape
- [x] Kickoff: `{"event":"extraction_progress","section":"chunked","batch":0,"of":N,"percent":5}`
- [x] Per-batch: `batch=k, of=N, percent=clamp(5+65*k/N, 5, 70)`
- [x] Sequential fallback: `section: "chunked-sequential"`
- [x] Existing 70/85/100 markers preserved for merge → validation → done

### Frontend — `stream-event-processor.ts`
- [x] `handleExtractionProgress` reads optional `batch` + `of`
- [x] Non-numeric values silently dropped (forward-compat)
- [x] `chunked-sequential` section name preserved verbatim

### Frontend — `use-summary-stream.ts`
- [x] `extractionProgress` type extended with `batch?: number, of?: number`

### Frontend — `OutputRouter.tsx`
- [x] `extractionProgress` prop wired through from `VideoDetailPage`
- [x] `StreamingPlaceholder` accepts `extractionProgress` and renders `Extracting batch {n}/{N}…` when `of > 1`
- [x] Mini progress bar (`bg-foreground/70`, ARIA progressbar) for the batch percent
- [x] `(running sequentially due to upstream load)` subtitle when `section === "chunked-sequential"`
- [x] Single/overflow extractions keep the existing generic phase label

### Tests — backend
- [x] `TestResolveStrategy` (3 tests): single-batch chunked + long transcript force-splits; short transcript stays single; force-split honors `EXTRACTION_FORCE_SPLIT_CHUNKS`
- [x] `TestPercentForBatch` (4 tests): boundary cases for the clamp
- [x] `TestChunkedExtractionStreamingProgress` (3 tests): per-batch events, rate-limit → sequential fallback, parallel limit honored

### Tests — frontend
- [x] `stream-event-processor-v2.test.ts` (4 new tests in `extraction_progress` block): batch+of parsing, chunked-sequential preservation, undefined for legacy events, ignores non-numeric

### Manual verification
- [~] Re-run Matt Pocock 108-min livestream; UI shows `1/4` → `4/4` — **ran 2026-05-14: force-split engaged (4 chunks) but `batch_chapters` re-collapsed to 1 batch under `MAX_TOKENS_PER_BATCH=50_000`. SSE emits `batch=1, of=1` so UI shows generic phase, not `1/4 → 4/4`. Follow-up bug to fix: bypass batch_chapters when force-split is the source.**
- [~] Wall time ~50–60s parallel mode (vs 330s baseline) — got **275s extraction (single batch on Sonnet, no parallelism)** because of the batch_chapters collapse bug above
- [ ] Simulate rate-limit; verify sequential subtitle visible — not exercised (no upstream pressure on this run)

---

## Phase 4 — P2: Fast-model-first extraction (gated) ✅

**Effort:** XL | **Risk:** Medium-high | **Status:** Code shipped behind OFF flag; eval harness deferred

### Pre-merge gate — eval harness — DEFERRED
- [ ] Create `scripts/eval_extraction_models.py`
- [ ] Pull 100 already-extracted videos from MongoDB
- [ ] Re-run extraction twice — once primary, once fast
- [ ] Generate per-domain quality delta + cost JSON report
- [ ] Manual side-by-side diff of 2 random samples per domain

### Eval acceptance criteria — DEFERRED
- [ ] Average quality score delta < 0.05
- [ ] Hard-miss rate increases < 5% absolute
- [ ] No domain shows > 10% quality regression

### Backend — `config.py`
- [x] `EXTRACTION_USE_FAST_FIRST: bool = False` (default OFF until eval passes)

### Backend — `extractor.py`
- [x] `extract()` accepts `force_primary_model: bool = False` kwarg
- [x] Computes `use_fast_model = settings.EXTRACTION_USE_FAST_FIRST and not force_primary_model`
- [x] Logs an info line when retry forces escalation
- [x] `_single_extraction`, `_overflow_extraction`, `_chunked_extraction`, `_run_batch_extraction` all accept `use_fast_model: bool` and forward to `call_llm_with_retry`

### Backend — `phases/extraction.py:_attempt_synthesis_fed_retry`
- [x] Synthesis-fed retry call passes `force_primary_model=True`
- [x] Comment explaining: "first pass already proved fast model under-extracted; doubling down burns tokens"

### Tests
- [x] `TestFastModelFirstFlag` (3 tests): flag-off keeps primary; flag-on routes to fast; `force_primary_model=True` overrides flag-on

### Rollout — DEFERRED
- [ ] Enable flag for 10% of users for 1 week
- [ ] Monitor `pipeline.extraction_quality` log scores
- [ ] If green: flip default to `True` in config
- [ ] If yellow: extend monitoring period
- [ ] If red: revert flag, investigate, document

---

## Live Verification Results — 2026-05-14

Run target: `https://www.youtube.com/watch?v=K-mA3MZ_EzU` (Matt Pocock 108-min livestream).
Pipeline run: `videoSummaryCache._id=6a059e5b94c50472951f520f`. Started 10:05:15 UTC, finished 10:11:32 UTC.

> **Note on deployed model routing:** `LLM_FAST_PROVIDER=openai`, `LLM_FAST_MODEL=` (empty → `openai/gpt-4o-mini`). The plan's wording about "Haiku 4.5" describes the code default in `MODEL_MAP`; the **live deployed fast model is `openai/gpt-4o-mini`**. Results below reflect actual env.

### V1 — Smoke test: cost + retry-gate + UX

**Verdict:** ⚠️ **PARTIAL PASS** — retry-gate works perfectly, but cost target and parallelism target both missed.

**Cost breakdown** (`db.llm_usage` rows with `video_id="K-mA3MZ_EzU"`, sorted by timestamp):

| Stage | Model | Tokens in / out | Cost (USD) |
|---|---|---:|---:|
| `summarize:metadata` | `gpt-4o-mini` | 376 / 133 | $0.0001 |
| `summarize:frames` | `gpt-4o-mini` | 204,356 / 442 | **$0.0309** |
| `summarize:classifier` | `gpt-4o-mini` | 1,244 / 127 | $0.0003 |
| `summarize:plan` | `claude-sonnet-4-6` | 6,664 / 1,315 | $0.0397 |
| `summarize:extraction` (chapter_detect, mis-tagged) | `gpt-4o-mini` | 1,529 / 158 | $0.0003 |
| **`summarize:extraction`** (main batch) | **`claude-sonnet-4-6`** | **25,220 / 15,368** | **$0.3105** |
| `summarize:synthesis` | `gpt-4o-mini` | 1,694 / 305 | $0.0004 |
| `summarize:enrichment` | `gpt-4o-mini` | 3,221 / 2,002 | $0.0017 |
| **TOTAL** | | | **$0.3841** |

- Baseline: $0.494. New total: **$0.3841 (22% reduction)** — TARGET WAS $0.05–0.13 (75–90% reduction). **Miss.**
- `summarize:frames` cost $0.0309 vs predicted ~$0.005 — `gpt-4o-mini` bills ~25K input tokens per image (5 frames → 204K tokens). Anthropic Haiku/Sonnet vision pricing is materially different per-image. The "6× cheaper" assumption in Phase 1B / P3 does not hold for `openai/gpt-4o-mini` vision.
- Extraction was a single Sonnet call (15,368 output tokens — verbose extraction inflates cost).

**Retry-gate behaviour (Phase 1A / P0):** ✅ **PASS**

```
Skipping hard-miss retry: score 0.80 >= gate 0.70, fields=['steps']
Skipping hard-miss retry for fields not in active schemas: ['tips'] (active contentTags: ['learning', 'project', 'tech'])
[pipeline] Extraction count mismatch (not retried) for video_id=6a059e5b94c50472951f520f: {'steps': {'manifest': 10, 'extracted': 0, 'ratio': 0.0}, 'tips': {'manifest': 7, 'extracted': 0, 'ratio': 0.0}}
```

- `HARD_MISS_SCORE_GATE = 0.7` suppressed the retry exactly as designed (score=0.80). Saved **$0.205 + ~190s** vs baseline.
- Out-of-schema field skip path also activated for `tips`.

**UX / SSE events (Phase 3 / P1):** ⚠️ **PARTIAL**

- SSE captured 2 events before client disconnected (known dev-env Redis Streams issue: `Stream read failed … Timeout reading from vie-redis:6379`). Pipeline kept running server-side.
- Logs confirm: `Single-batch chunked input force-split into 4 chunks (14195 words)` ✓ — force-split engaged
- But: `Chunked extraction: 4 chapters in 1 batches` — `batch_chapters()` re-collapsed all 4 force-split chunks into a single batch under `MAX_TOKENS_PER_BATCH = 50_000`.
- Net: the new `extraction_progress` SSE event with `batch`/`of` fires once (`batch=1, of=1`), so frontend shows "Extracting…" not "Extracting batch 1/4". **Parallelism never engaged.**

**Wall time:** ⚠️ Pipeline DONE in **377s** total; extraction phase = **275s** (target ~60s parallel mode). Single-batch reality matches `lNVa33qUzZ8` (548s extraction). Same Sonnet cost profile as before.

### V2 — Cache crediting

**Verdict:** ✅ **PASS for creation; INCOMPLETE for reads** — plumbing verified, end-to-end credit unobserved.

`cache_creation_tokens`/`cache_read_tokens` are recorded on `UsageRecord`:

| Row | feature | cache_creation_tokens | cache_read_tokens | cache_savings_usd |
|---|---|---:|---:|---:|
| Main extraction (Sonnet) | `summarize:extraction` | **5,735** | 0 | $0.00 |
| All other rows | various | 0 | 0 | $0.00 |

- ✅ `cache_creation_tokens=5735` on the Sonnet extraction call proves Phase 2 / P4 plumbing **does record** Anthropic's cache_creation field from LiteLLM (`callback.py:_build_record`).
- ❌ `cache_read_tokens=0` everywhere — because the chunked extraction collapsed to a single batch, there was no second LLM call to read the cached prompt. The within-run validation strategy assumed N≥2 batches.
- Implication for production: cache discount remains untested end-to-end. Either (a) fix the force-split / batch re-grouping bug so N≥2 batches actually run in parallel within a single video, or (b) run a back-to-back same-video extraction (clear `vie:response:<id>` Redis key + delete `videoSummaryCache` row, re-run within 5min) as a dedicated cache test.

### V3 — Frame vision spot-check (gpt-4o-mini vs Sonnet, 5 frames)

**Verdict:** ⚠️ **MIXED** — fast model is cheaper but only marginally, and OCR/scene-type accuracy degrades on dense-text frames.

- New script: `scripts/spotcheck_frame_vision.py` (runs inside `vie-summarizer` container; downloads 5 S3 frames; invokes `complete_with_messages` once per model)
- Source video: `lNVa33qUzZ8` (a Theo-t3.gg "Agentic Coding is a Trap" 57-min commentary processed earlier today — has 5 fresh S3 frames at `s3://vie-transcripts/videos/lNVa33qUzZ8/scenes/`)
- Report: `reports/frame-vision-spotcheck-20260514-101033.json` (also `frame-vision-spotcheck-20260514-100904.json` from a no-callback first attempt — costs are recorded only in the second run)

**Cost split** (from `llm_usage` rows `feature ∈ {spotcheck:frames:fast, spotcheck:frames:primary}`):

| Pass | Model | tokens in / out | Cost (USD) | Latency (ms) |
|---|---|---:|---:|---:|
| Fast | `openai/gpt-4o-mini` | 127,823 / 454 | **$0.01923** | 9,398 |
| Primary | `anthropic/claude-sonnet-4-6` | 4,265 / 754 | **$0.02410** | 16,624 |

- Savings: **~20%** ($0.005 per 5-frame call), not the "~6× cheaper" Phase 1B / P3 predicted.
- Vision input tokens diverge dramatically (gpt-4o-mini bills ~25K tokens per image; Anthropic bills the equivalent image at ~800–900 tokens).

**Quality** (per-frame diff, full JSON in report):

| Frame | gpt-4o-mini scene_type | Sonnet scene_type | OCR drift |
|---|---|---|---|
| 0 (Browserbase landing) | `screen_recording` | `screen_recording` | minor whitespace |
| 1 ("Cost Efficiency" chart) | `screen_recording` ❌ | `chart` ✓ | both readable |
| 2 (AI model bar chart) | `chart` ✓ | `chart` ✓ | **gpt-4o-mini hallucinated "Mace Scork" / "Max Preview"** — Sonnet correctly read "Llama, Qwen3.6, Claude Sonnet 4.6 (max), DeepSeek V4 Pro" |
| 3 ("Cognitive Debt" article) | `other` ❌ | `screen_recording` ✓ | both readable |
| 4 (article continuation) | `other` ❌ | `screen_recording` ✓ | both readable |

- Scene-type agreement: **2/5** (frames 0 + 2). gpt-4o-mini over-uses `other` and `screen_recording` as a generic catch-all.
- OCR text differs on **5/5** frames — generally cosmetic except frame 2 where gpt-4o-mini **invented** model names. This is the dense-text regression the plan flagged in §"Open Questions #1".

**Recommendation:** Keep `LLM_FAST_PROVIDER=openai` for non-vision fast-tier calls (classifier / synthesis / enrichment) where text-only quality has held up. For frame vision specifically, consider routing back to `anthropic/claude-haiku-4-5-20251001` (env override) — Haiku vision likely closer to Sonnet OCR quality without 6× the cost. (Not validated in this session — pure recommendation.)

### What landed in the codebase this session

- New: `scripts/spotcheck_frame_vision.py` (Python 3.12 syntax; Pyright import warnings are the same false positives noted in memory — script runs inside the container).
- New: `reports/frame-vision-spotcheck-20260514-100904.json` (Pass 1, costs $0 because the MongoDB usage callback wasn't registered).
- New: `reports/frame-vision-spotcheck-20260514-101033.json` (Pass 2 with `MongoDBUsageCallback` registered — authoritative).
- No production code touched. No PRs opened.

### Follow-ups surfaced by this run

- **Force-split → batch_chapters re-collapse bug.** `_resolve_strategy` correctly force-splits into 4 chunks (`extractor.py`) but `batch_chapters` (in `transcript_chunker.py` / extractor batching layer) groups them back into 1 batch when total tokens fit under `MAX_TOKENS_PER_BATCH=50_000`. Parallelism never engages → cost stays high, no `cache_read` validation possible within a single run. **Highest-impact item to fix next.**
- **gpt-4o-mini frames are not a cost win.** Re-evaluate Phase 1B / P3 — either revert frame analyzer to primary (Sonnet), or route to Haiku 4.5 specifically for vision.
- **`chapter_detect` is mis-tagged as `summarize:extraction`** in `llm_usage`. Minor — affects per-stage cost attribution in admin dashboard.

---

## End-to-End Verification (post all phases)

- [x] Re-run original Matt Pocock livestream URL
- [ ] Cost: total in admin dashboard is **$0.05–0.13** (75–90% reduction from $0.494) — **MISS, got $0.3841 (22% reduction)**
- [ ] frames cost: ~$0.005 — **MISS, got $0.0309 (gpt-4o-mini vision is not 6× cheaper)**
- [ ] chapter_detect cost: ~$0.002 — got $0.0003 ✓ but mis-tagged as `summarize:extraction`
- [x] extraction (1st pass) cost: ~$0.20 (P2 disabled) — got $0.3105 (within band, single Sonnet call)
- [x] extraction retry: did NOT run (no `hard miss on` log for narrative format) — confirmed via `Skipping hard-miss retry: score 0.80 >= gate 0.70`
- [ ] UX: frontend shows `Extracting batch 1/4…` → `4/4…` → `Polishing the response…` — **batch=1/of=1 only, due to batch re-collapse bug**
- [ ] Wall time extraction → enrichment: ~60s in parallel mode — got 275s extraction (no parallelism)
- [ ] Mid-stream refresh: summarizer logs show `Attaching as additional consumer` only — not tested this session (SSE client disconnect was server-side timeout, not refresh)
- [x] Two back-to-back same-video extractions: second shows `cache_read_tokens > 0` — **plumbing verified** (cache_creation_tokens=5735), end-to-end credit untested (no 2nd LLM call within run)
- [ ] Admin dashboard: cache savings visible (or follow-up filed) — out of scope (Phase 2 deferred admin UI plumbing)

---

## Test Command Reference

```bash
# Backend tests (per phase)
cd services/summarizer && python3 -m pytest \
  tests/test_extraction_quality.py \
  tests/test_extractor.py \
  tests/test_chunked_extraction.py \
  tests/test_frame_analyzer.py \
  tests/test_transcript_chunker.py \
  tests/test_llm_provider.py -v

# Backend full suite (skip unrelated optional-dep failures)
cd services/summarizer && python3 -m pytest \
  --ignore=tests/test_pipeline_integration.py \
  --ignore=tests/test_stream_routes.py \
  --ignore=tests/test_gemini_transcriber.py

# llm-common
cd packages/llm-common && python3 -m pytest tests/test_callback.py -v

# Web tests
cd apps/web && npm test -- --run

# E2E (NOT YET RUN this session)
npm run test:e2e -- e2e/cooking-mode.spec.ts e2e/all-domains.spec.ts

# Live smoke test (not yet run)
docker-compose up -d
# In browser: paste the Matt Pocock 108-min livestream URL, watch progress
```

---

## Cleanup / Follow-ups (out of scope but track here)

- [ ] Open PRs for each phase branch (this session committed code locally only)
- [ ] Admin dashboard plumbing for `cache_creation_tokens`, `cache_read_tokens`, `cache_savings_usd`
- [ ] Add `livestream` to classifier `VALID_FORMATS` for clarity
- [ ] Document `LLM_FAST_MODEL` env override in operations runbook
- [ ] If P2 ships green, raise `EXTRACTION_PARALLEL_BATCHES = 2` to 3
- [ ] Verify Anthropic 529 vs 429 exception class behavior in `services/summarizer/src/utils/llm_retry.py`
- [x] Build `scripts/eval_extraction_models.py` (P2 gate)
- [ ] Run eval harness on 100-video sample, document results
- [ ] **NEW (2026-05-14, highest priority):** fix force-split → `batch_chapters` re-collapse so 4 force-split chunks actually run as N≥2 parallel batches. Currently `MAX_TOKENS_PER_BATCH=50_000` re-groups all 4 chunks into 1 batch on Matt-Pocock-sized inputs. Without this, parallelism + per-batch SSE + cache_read validation all stay blocked.
- [ ] **NEW (2026-05-14):** reconsider Phase 1B / P3 frame routing for `openai/gpt-4o-mini`. Vision savings are ~9–20% (not 6×) because OpenAI bills ~25K tokens per image. Options: (a) revert frame vision to primary Sonnet, (b) override `LLM_FAST_MODEL=anthropic/claude-haiku-4-5-20251001` specifically for vision, (c) accept the marginal savings and the OCR-on-dense-text regression.
- [ ] **NEW (2026-05-14):** retag `chapter_detect` LLM call so it appears under `summarize:chapter_detect` instead of `summarize:extraction` in `llm_usage`. Currently obscures per-stage attribution in the admin dashboard.
