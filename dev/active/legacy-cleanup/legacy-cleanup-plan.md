# Legacy Cleanup: Comprehensive Plan

> Last Updated: 2026-03-10
> Status: NOT STARTED
> Effort: XL (across all services)

---

## Executive Summary

The codebase has accumulated legacy artifacts across multiple version transitions (V1 chapter-based → V2 intent-driven pipeline → V3 domain-based triage pipeline). This plan systematically removes all legacy code, unused references, version comments, migration artifacts, deprecated functions, and backward-compatibility shims — aligning the entire application to the current unified approach.

**Key principle:** The current system has ONE pipeline (intent-driven, stored as `output`). V3 is behind a feature flag and WIP. V1 chapter-based code is dead weight. Migration scripts have already been run. Version comments (V1.4, V2.1, etc.) are noise.

---

## Current State Analysis

### What's Legacy (to remove)

1. **Summarizer: V1 legacy cache streamer** (`_stream_cached_result` in stream.py) — streams old `summary.chapters` format
2. **Summarizer: `save_result()` in mongodb_repository.py** — deprecated method for chapter-based pipeline
3. **Summarizer: `_determine_persona()` in youtube.py** — deprecated, TODO says remove
4. **Summarizer: Duplicate `VIE_RESPONSE_VERSION` config** — defined twice in config.py (lines 87 and 114)
5. **Explainer: V1 backward compat code** — `_build_video_context()` V1 chapter fallback, `explain_auto.py` V1 section handling, `mongodb_repository.py` V1 chapter reading
6. **API: memorize.service.ts V1 section fallback** — `v1Sections` code path reading `summary.sections`
7. **Types: `@migration` annotations** — backfill-v1.4 already confirmed, `tier` can be marked required
8. **Types: Version comments** — "(V1.4)", "(V1.5)", "(V2.1)" comments throughout index.ts
9. **Types: `SummaryChapter` and `Concept` types** — still used by MemorizedItem, ContentBlocks, sse-validators; need careful analysis
10. **Frontend: `glass-surface` CSS class** — marked "legacy" in blocks.css, used by 2 block components
11. **Frontend: OutputRouter v2/legacy comments** — comments referencing v2/legacy paths
12. **Frontend: `share.ts` deprecated blocks field** — `@deprecated Legacy content blocks for old shares`
13. **Frontend: `stream-event-processor.ts` legacy phase cast comment** — line 32
14. **Scripts: Migration/backfill scripts** — `backfill-v1.4.ts`, `rollback-v1.4.ts`, `backfill-pipeline-version.ts` already run
15. **Active task docs that are COMPLETED** — `pipeline-cleanup` (COMPLETED), `pipeline-v2` (92% done)

### What's NOT Legacy (keep)

- V3 pipeline (`stream_v3.py`, `domain_types.py`, `triage.py`, `post_processor.py`, `prompt_builder.py`) — active WIP behind feature flag
- `_stream_cached_structured` — current pipeline's cache streamer
- `ContentBlocks.tsx` — still used by MemorizedItemDetail + RAGChatPanel
- `ContentBlockRenderer.tsx` — actively used by output system
- `sse-validators.ts` / `block-schemas.ts` — actively used by streaming
- `concept-utils.ts` — used by timestamp-utils for sidebar matching
- `block-labels.ts` — used by 20+ block components

---

## Implementation Phases

### Phase 1: Python Summarizer Cleanup [M]
Remove legacy code from the summarizer service.

| Task | Effort | Description |
|------|--------|-------------|
| 1.1 | S | Delete `_stream_cached_result()` from stream.py (legacy chapter-based cache streamer) |
| 1.2 | S | Remove the `is_v3`/`is_structured`/legacy detection branch — simplify to: v3 → `_stream_cached_v3`, else → `_stream_cached_structured` |
| 1.3 | S | Delete `save_result()` from mongodb_repository.py and base.py (deprecated, no callers in new pipeline) |
| 1.4 | S | Delete `_determine_persona()` from youtube.py (deprecated, tests use `select_persona()`) |
| 1.5 | S | Remove duplicate `VIE_RESPONSE_VERSION` in config.py (lines 86-87 duplicate of 113-114) |
| 1.6 | S | Clean up tests referencing `_determine_persona` in test_youtube_service.py |

**Acceptance criteria:** All summarizer tests pass. No callers of removed functions.

### Phase 2: Python Explainer Cleanup [M]
Remove V1 backward-compat code from the explainer service.

| Task | Effort | Description |
|------|--------|-------------|
| 2.1 | S | Remove V1 chapter fallback from `_build_video_context()` in video_chat.py (lines 58-71) — keep only output_data path |
| 2.2 | S | Remove V1 section fallback from `explain_auto.py` (lines 64-72) — keep only output_data path |
| 2.3 | S | Remove V1 `summary.chapters` reading from explainer's `mongodb_repository.py` `_to_entity()` — keep output_data reading |
| 2.4 | S | Update explainer tests for removed V1 paths |

**Acceptance criteria:** All explainer tests pass. No references to V1 chapters in explainer.

### Phase 3: API Service Cleanup [M]
Remove V1 backward-compat from the API.

| Task | Effort | Description |
|------|--------|-------------|
| 3.1 | M | Remove V1 `v1Sections` fallback from `memorize.service.ts` (lines 144-158) — keep only output_data path |
| 3.2 | S | Update memorize service tests |

**Acceptance criteria:** All API tests pass.

### Phase 4: Types Package Cleanup [M]
Clean version annotations and migration markers.

| Task | Effort | Description |
|------|--------|-------------|
| 4.1 | S | Remove all `(V1.4)`, `(V1.5)`, `(V2.1)` version comments from `packages/types/src/index.ts` |
| 4.2 | S | Remove `@migration` annotations — mark `tier` as required on User type (backfill confirmed) |
| 4.3 | S | Remove `// Share (V1.4)`, `// Tier & Payment (V1.4)` section comments — replace with descriptive headers if needed |
| 4.4 | S | Clean up `// ===== NEW UNIVERSAL BLOCKS (V2.1) =====` and `// ===== CATEGORY-SPECIFIC BLOCKS (V2.1) =====` headers |
| 4.5 | S | Remove `// User Types (V1.5)`, `// Like Collection Type (V1.5)`, `// User Tier & Limits (V1.4 — Monetization)`, `// Share Types (V1.4 — Public Sharing)` |

**Acceptance criteria:** No version numbers in type comments. Types compile. All downstream services build.

### Phase 5: Frontend Cleanup [S]
Remove legacy comments and deprecated markers.

| Task | Effort | Description |
|------|--------|-------------|
| 5.1 | S | Clean OutputRouter.tsx comments: remove "v2/legacy" references, update JSDoc |
| 5.2 | S | Replace `glass-surface` CSS class usage in FitnessBlock.tsx and ItineraryBlock.tsx with GlassCard or direct glass CSS vars |
| 5.3 | S | Remove `/* legacy — kept for backward compatibility */` comment from blocks.css (keep the class if still used) |
| 5.4 | S | Remove `@deprecated` tag from share.ts blocks field (or remove the field if no longer needed) |
| 5.5 | S | Clean `stream-event-processor.ts` line 32 comment about legacy phases |

**Acceptance criteria:** All web tests pass. No "legacy", "v2", "backward compat" comments in active code.

### Phase 6: Migration Scripts & Dev Docs Cleanup [S]
Remove completed migration scripts and task docs.

| Task | Effort | Description |
|------|--------|-------------|
| 6.1 | S | Delete `scripts/backfill-v1.4.ts` (already run, confirmed) |
| 6.2 | S | Delete `scripts/rollback-v1.4.ts` (safety rollback for completed migration) |
| 6.3 | S | Delete `scripts/backfill-pipeline-version.ts` (already run) |
| 6.4 | S | Move completed active tasks to `dev/completed/`: `pipeline-cleanup`, `pipeline-v2` |
| 6.5 | S | Clean TODOs: remove "v1.5" TODOs from api/src/ (app.ts, auth.routes.ts, cost-monitor.service.ts, payment.service.ts, theme-provider.tsx) — either implement or remove if not planned |

**Acceptance criteria:** No completed task dirs in `dev/active/`. No stale migration scripts.

### Phase 7: API version comments & TODO audit [S]
Clean remaining version noise across the codebase.

| Task | Effort | Description |
|------|--------|-------------|
| 7.1 | S | Clean version comments in api/src/repositories/ (`// Share fields (V1.4)`, `// Profile fields (V1.5)`, etc.) |
| 7.2 | S | Audit remaining TODOs — categorize as: (a) still valid → keep, (b) done → remove, (c) won't do → remove |

**Acceptance criteria:** No version-tagged comments in API code.

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Removing V1 cache streamer breaks old cached data | High | Verify: are there any `summary.chapters`-only documents in production MongoDB? If yes, need migration first |
| Removing V1 from explainer breaks chat for old videos | Medium | Old videos with only `summary.chapters` won't have chat context — acceptable if re-summarization available |
| Making `tier` required breaks pre-backfill documents | Low | Backfill already confirmed per v1.4 contracts task |
| Removing share.ts `blocks` breaks old shared links | Medium | Check if any shared links reference old block format |

---

## Success Metrics

- Zero "legacy", "V1", "backward compat" comments in active source code (excluding V3 WIP and test fixtures)
- Zero `@migration` or `@deprecated` annotations referencing completed migrations
- Zero completed task directories in `dev/active/`
- All test suites pass (API 606, Web 1053+, Summarizer 739+, Explainer 48+, E2E 136+)
- Net line count reduction of ~500+ lines

---

## Dependencies

- **Pre-check required:** Query production MongoDB for documents with `summary.chapters` but no `output` field. If any exist, Phase 1 task 1.1/1.2 needs a "fallback to legacy streamer" safety net OR a data migration.
- Phase 1-5 are independent and can be done in parallel
- Phase 6 depends on Phase 1-5 being complete (to ensure no regressions)
