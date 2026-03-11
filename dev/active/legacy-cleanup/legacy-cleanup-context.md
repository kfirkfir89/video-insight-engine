# Legacy Cleanup: Context

> Last Updated: 2026-03-10

---

## Key Files to Modify

### Python Summarizer
| File | What to Change |
|------|---------------|
| `services/summarizer/src/routes/stream.py:314-380` | Remove `_stream_cached_result()`, simplify cache detection branch |
| `services/summarizer/src/repositories/mongodb_repository.py:50-99` | Delete `save_result()` method |
| `services/summarizer/src/repositories/base.py:24` | Delete `save_result()` abstract method |
| `services/summarizer/src/services/video/youtube.py:424-454` | Delete `_determine_persona()` |
| `services/summarizer/src/config.py:86-87` | Remove duplicate `VIE_RESPONSE_VERSION` |
| `services/summarizer/tests/test_youtube_service.py:84-153` | Remove `_determine_persona` tests |

### Python Explainer
| File | What to Change |
|------|---------------|
| `services/explainer/src/tools/video_chat.py:50-78` | Remove V1 chapter fallback in `_build_video_context()` |
| `services/explainer/src/tools/explain_auto.py:64-72` | Remove V1 section fallback |
| `services/explainer/src/repositories/mongodb_repository.py:47-56` | Remove V1 `summary.chapters` reading |

### API
| File | What to Change |
|------|---------------|
| `api/src/services/memorize.service.ts:144-158` | Remove V1 `v1Sections` fallback |

### Types
| File | What to Change |
|------|---------------|
| `packages/types/src/index.ts` | Remove version comments (V1.4, V1.5, V2.1), `@migration` annotations |

### Frontend
| File | What to Change |
|------|---------------|
| `apps/web/src/components/video-detail/OutputRouter.tsx` | Remove v2/legacy comments |
| `apps/web/src/styles/blocks.css:564` | Remove "legacy" comment |
| `apps/web/src/api/share.ts:20` | Remove `@deprecated` on blocks field |
| `apps/web/src/lib/stream-event-processor.ts:32` | Remove legacy comment |
| `apps/web/src/components/video-detail/blocks/FitnessBlock.tsx` | Replace `glass-surface` usage |
| `apps/web/src/components/video-detail/blocks/ItineraryBlock.tsx` | Replace `glass-surface` usage |

### Scripts (DELETE)
| File | Action |
|------|--------|
| `scripts/backfill-v1.4.ts` | Delete |
| `scripts/rollback-v1.4.ts` | Delete |
| `scripts/backfill-pipeline-version.ts` | Delete |

### Dev Docs (MOVE to completed)
| Directory | Action |
|-----------|--------|
| `dev/active/pipeline-cleanup/` | Move to `dev/completed/` |
| `dev/active/pipeline-v2/` | Move to `dev/completed/` |

---

## What NOT to Touch

- `ContentBlocks.tsx` — used by MemorizedItemDetail + RAGChatPanel
- `ContentBlockRenderer.tsx` — actively used
- `sse-validators.ts` / `block-schemas.ts` — actively used for streaming
- `concept-utils.ts` — used by timestamp-utils
- `block-labels.ts` — used by 20+ components
- V3 pipeline files (`stream_v3.py`, `domain_types.py`, `triage.py`, etc.) — active WIP
- `_stream_cached_v3` — active V3 cache handler
- `_stream_cached_structured` — current pipeline's cache handler
- `SummaryChapter` / `Concept` types — still used by MemorizedItem, downstream consumers

---

## Key Decisions

1. **V1-only cached documents:** If production has documents with only `summary.chapters` (no `output`), removing `_stream_cached_result` will break them. Need to verify before Phase 1.

2. **`tier` field:** Making it required on User type assumes backfill-v1.4 ran on production. Confirmed in v1.4 contracts task.

3. **`blocks` field on ShareData:** If old shared links exist with content blocks but no output, removing this field breaks those shares. Keep the field but remove the `@deprecated` tag — it's just a data field, not a migration artifact.

4. **v1.5 TODOs:** These reference planned features (PostHog analytics, referral slugs, SES emails, theme persistence). Decision: keep as TODOs but remove the "v1.5" version prefix — they're just future features.

---

## Test Commands

```bash
# API
cd api && npm test

# Web
cd apps/web && npm test

# Summarizer
cd services/summarizer && python -m pytest tests/ -v

# Explainer
cd services/explainer && python -m pytest tests/ -v

# E2E
cd apps/web && npx playwright test
```
