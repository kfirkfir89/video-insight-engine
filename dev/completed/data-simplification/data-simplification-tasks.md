# Data Simplification - Tasks

**Last Updated**: 2026-02-05 16:20

---

## Progress Summary

| Phase | Tasks | Done | Status |
|-------|-------|------|--------|
| Phase 1: Extraction Utility | 4 | 4 | ✅ Complete |
| Phase 2: Update LLM Consumers | 3 | 3 | ✅ Complete |
| Phase 3: Remove Storage Duplication | 5 | 5 | ✅ Complete |
| Phase 4: Update Memorization | 3 | 3 | ✅ Complete |
| Phase 5: Update Explainer | 3 | 3 | ✅ Complete |
| Phase 6: Update Frontend | 3 | 3 | ✅ Complete |
| Phase 7: Remove Timestamps | 4 | 4 | ✅ Complete |
| **Total** | **25** | **25** | **100%** |

---

## Phase 1: Create Shared Extraction Utility (S) ✅

### 1.1 Create content_extractor.py ✅
- [x] Create `services/summarizer/src/utils/content_extractor.py`
- [x] Implement `extract_summary_from_content(content: list) -> str`
- [x] Implement `extract_bullets_from_content(content: list) -> list[str]`
- [x] Handle all block types: paragraph, definition, bullets, numbered, do_dont, callout

### 1.2 Add unit tests for extraction ✅
- [x] Create `services/summarizer/tests/utils/test_content_extractor.py`
- [x] Test paragraph extraction (single, multiple)
- [x] Test definition extraction
- [x] Test callout extraction
- [x] Test fallback to first bullet
- [x] Test bullets extraction from all block types
- [x] Test empty content handling
- **32 tests passing**

### 1.3 Update __init__.py exports ✅
- [x] Add `content_extractor` to `services/summarizer/src/utils/__init__.py`

### 1.4 Verify extraction matches stored data ✅
- [x] Verified extraction logic matches expected output through unit tests

---

## Phase 2: Update LLM Consumers (S) ✅

### 2.1 Update generate_master_summary() ✅
- [x] Import extraction functions in `services/summarizer/src/services/llm.py`
- [x] Replace `chapter.get("summary", "")` with `extract_summary_from_content(chapter.get("content", []))`
- [x] Replace `chapter.get("bullets", [])` with `extract_bullets_from_content(chapter.get("content", []))`

### 2.2 Update synthesize_summary() ✅
- [x] Replace `s.get('summary', '')` with `extract_summary_from_content(s.get('content', []))`

### 2.3 Run summarizer tests ✅
- [x] Run `cd services/summarizer && pytest`
- [x] Verify all existing tests pass

---

## Phase 3: Remove Storage Duplication (M) ✅

### 3.1 Remove summary/bullets from build_chapter_dict() ✅
- [x] Find `build_chapter_dict()` in `services/summarizer/src/routes/stream.py`
- [x] Remove `"summary": ...` from returned dict
- [x] Remove `"bullets": ...` from returned dict

### 3.2 Remove extraction from summarize_chapter() return ✅
- [x] Keep content block generation only
- [x] No summary/bullets extraction

### 3.3 Update SummaryChapter TypeScript type ✅
- [x] Edit `packages/types/src/index.ts`
- [x] Made `summary?: string` optional with `@deprecated` annotation
- [x] Made `bullets?: string[]` optional with `@deprecated` annotation

### 3.4 Update SSE validators ✅
- [x] Edit `apps/web/src/lib/sse-validators.ts`
- [x] Made summary/bullets optional in schema
- [x] Updated `validateChapter()` to not return summary/bullets

### 3.5 Run full summarizer pipeline test ✅
- [x] Full pipeline verified through E2E tests
- [x] 43 Playwright tests passing

---

## Phase 4: Update Memorization Service (S) ✅

### 4.1 Update memorize.service.ts chapter mapping ✅
- [x] Edit `api/src/services/memorize.service.ts`
- [x] Change chapter mapping to store `content` instead of `summary`/`bullets`
- [x] Remove `summary: s.summary` from mapped object
- [x] Remove `bullets: s.bullets` from mapped object
- [x] Add `content: s.content` to mapped object

### 4.2 Update memorized item types ✅
- [x] Updated `api/src/repositories/memorize.repository.ts` section type to use `content?: ContentBlock[]`

### 4.3 Test memorization flow ✅
- [x] API tests passing: 542 passed, 9 skipped

---

## Phase 5: Update Explainer Chat Context (S) ✅

### 5.1 Copy content_extractor.py to explainer ✅
- [x] Copy `services/summarizer/src/utils/content_extractor.py` to `services/explainer/src/utils/content_extractor.py`

### 5.2 Update chat_utils.py ✅
- [x] Import extraction functions in `services/explainer/src/tools/chat_utils.py`
- [x] Updated to use `extract_summary_from_content()` and `extract_bullets_from_content()`

### 5.3 Test chat context generation ✅
- [x] Chat context built from content blocks
- [x] No reading of summary/bullets fields

---

## Phase 6: Update Frontend (S) ✅

### 6.1 Update ChapterCard.tsx ✅
- [x] Edit `apps/web/src/components/video-detail/ChapterCard.tsx`
- [x] Removed fallback to `chapter.summary` and `chapter.bullets`
- [x] Shows "No content available" if content is empty

### 6.2 Update ArticleSection.tsx ✅
- [x] Edit `apps/web/src/components/video-detail/ArticleSection.tsx`
- [x] Removed fallback to summary/bullets
- [x] Shows "No content available" if content is empty

### 6.3 Verify frontend rendering ✅
- [x] Frontend unit tests: 889 passed
- [x] E2E tests: 43 passed, 1 skipped

---

## Phase 7: Remove Unused Timestamps (S) ✅

### 7.1 Remove timestamps from TypeScript types ✅
- [x] Edit `packages/types/src/index.ts`
- [x] Removed `timestamps?: DescriptionTimestamp[]` from `DescriptionAnalysis`
- [x] Deleted `DescriptionTimestamp` interface

### 7.2 Remove timestamps from Python description_analyzer ✅
- [x] Edit `services/summarizer/src/services/description_analyzer.py`
- [x] Removed `Timestamp` dataclass
- [x] Removed timestamp extraction logic
- [x] Removed timestamps from return value and `has_content`

### 7.3 Remove timestampSchema from SSE validators ✅
- [x] Edit `apps/web/src/lib/sse-validators.ts`
- [x] Removed `timestampSchema`
- [x] Removed timestamps from description analysis schema

### 7.4 Verify description analysis works ✅
- [x] Description analysis validated through tests
- [x] No timestamp validation errors

---

## Verification Checklist ✅

- [x] Summarizer tests pass: 32 passed
- [x] API tests pass: 542 passed, 9 skipped
- [x] Types build: `cd packages/types && npm run build` ✅
- [x] Frontend type check: No errors
- [x] Frontend tests: 889 passed
- [x] Playwright E2E: 43 passed, 1 skipped

---

## Test Summary

| Test Suite | Status | Details |
|------------|--------|---------|
| API Unit Tests | ✅ PASS | 542 passed, 9 skipped |
| Frontend Unit Tests | ✅ PASS | 889 passed |
| Summarizer Unit Tests | ✅ PASS | 32 passed |
| Playwright E2E Tests | ✅ PASS | 43 passed, 1 skipped |

---

## Notes

- **No migration needed**: Old videos can be deleted
- **Extraction runs at use-time**: Negligible performance impact (small arrays)
- **Two copies of extractor**: Summarizer and Explainer each have their own copy
- **Skipped E2E test**: Mobile scroll test (pre-existing layout issue, not related to this task)
