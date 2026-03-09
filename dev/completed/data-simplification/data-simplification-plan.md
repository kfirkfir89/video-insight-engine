# Video Response Data Simplification Plan

**Last Updated**: 2026-02-05
**Status**: Ready for Implementation
**Effort**: Medium (M) - 2-3 developer-days

---

## Executive Summary

Remove data duplication in video response storage by eliminating pre-computed `summary` and `bullets` fields from chapter data. These fields are pure extractions from `content` blocks and can be regenerated on-demand when needed for LLM prompts or chat context.

**Key Insight**: Analysis of production data confirms `summary` and `bullets` contain zero unique data - they are deterministic extractions from `content` blocks.

---

## Current State Analysis

### The Problem

Each chapter stores three overlapping data representations:
1. `content` - Array of ContentBlocks (source of truth)
2. `summary` - Extracted paragraph text from content blocks
3. `bullets` - Extracted list items from content blocks

**Pattern Analysis (18 chapters from respone.json)**:
| Field | Pattern | Source |
|-------|---------|--------|
| `summary` | First paragraph text (16/18) | `content.filter(paragraph).map(text).join(' ')` |
| `summary` | All paragraphs joined (1/18) | Same |
| `summary` | Callout text (1/18) | `content.filter(callout).map(text)` |
| `bullets` | 100% match with items from blocks | `content.filter(bullets\|numbered\|callout).flatMap(items)` |

**Impact**:
- ~5-7KB duplication per video
- Three sources of truth for same data
- Potential consistency bugs if content and summary/bullets diverge

### Current Consumers

| Consumer | File | Currently Reads |
|----------|------|-----------------|
| Master Summary | `llm.py:872-886` | `chapter.summary`, `chapter.bullets` |
| Global Synthesis | `llm.py:467-468` | `s.summary` |
| Memorization | `memorize.service.ts:152-158` | `s.summary`, `s.bullets` |
| Chat Context | `chat_utils.py:19-28` | `section.summary`, `section.bullets` |
| Frontend Fallback | `ChapterCard.tsx:103-121` | `chapter.summary`, `chapter.bullets` |

---

## Proposed Future State

### Core Principle: Extract On-Demand, Not At Storage

1. **Storage**: Only store `content` blocks (single source of truth)
2. **Consumption**: Extract summary/bullets at use-time via shared utility functions
3. **No Migration**: Delete old videos rather than migrate (per user requirement)

### New Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Storage                          │
│                                                      │
│   Chapter: { id, title, timestamp, content[] }      │
│              (no summary, no bullets)                │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│              content_extractor.py                    │
│  ┌─────────────────────────────────────────────────┐│
│  │ extract_summary_from_content(content) → str     ││
│  │ extract_bullets_from_content(content) → list    ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────┬───────────────────────────────┘
                      │
          ┌───────────┼───────────┬───────────┐
          ▼           ▼           ▼           ▼
     Master Sum   Synthesis    Memorize   Chat Context
```

---

## Implementation Phases

### Phase 1: Create Shared Extraction Utility (S)

Create a new utility module that both Python services can use for on-demand extraction.

**Files**:
- **NEW**: `services/summarizer/src/utils/content_extractor.py`

**Functions**:
- `extract_summary_from_content(content: list) -> str`
- `extract_bullets_from_content(content: list) -> list[str]`

**Priority**: paragraphs > definitions > callouts > first bullet item

---

### Phase 2: Update LLM Consumers (S)

Update summarizer LLM functions to extract from `content` instead of reading pre-computed fields.

**Files**:
- `services/summarizer/src/services/llm.py`

**Changes**:
1. `generate_master_summary()` - Extract from `chapter.content`
2. `synthesize_summary()` - Extract from `s.content`

---

### Phase 3: Remove Storage Duplication (M)

Stop storing `summary` and `bullets` in chapter output.

**Files**:
- `services/summarizer/src/routes/stream.py` - Remove from `build_chapter_dict()`
- `services/summarizer/src/services/llm.py` - Remove extraction from chapter returns
- `packages/types/src/index.ts` - Remove from `SummaryChapter` type

---

### Phase 4: Update Memorization Service (S)

Update memorization to store `content` instead of `summary`/`bullets`.

**Files**:
- `api/src/services/memorize.service.ts`

**Changes**:
- Copy `content` blocks instead of `summary`/`bullets`
- Extract on-demand when building chat context

---

### Phase 5: Update Explainer Chat Context (S)

Copy extraction utility to explainer service and update chat context builder.

**Files**:
- **NEW**: `services/explainer/src/utils/content_extractor.py` (copy)
- `services/explainer/src/tools/chat_utils.py`

**Changes**:
- Use extraction functions instead of reading `summary`/`bullets`

---

### Phase 6: Update Frontend (S)

Remove legacy fallback rendering since all data now comes from `content` blocks.

**Files**:
- `apps/web/src/components/video-detail/ChapterCard.tsx`
- `apps/web/src/components/video-detail/ArticleSection.tsx`

**Changes**:
- Remove fallback to `summary`/`bullets` when `content` is empty
- Show empty state instead (or nothing)

---

### Phase 7: Remove Unused Timestamps (S)

Remove completely unused `descriptionAnalysis.timestamps` field.

**Files**:
- `packages/types/src/index.ts` - Remove `timestamps` from `DescriptionAnalysis`, delete `DescriptionTimestamp`
- `services/summarizer/src/services/description_analyzer.py` - Remove `Timestamp` dataclass
- `apps/web/src/lib/sse-validators.ts` - Remove `timestampSchema`

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Extraction logic differs from stored values | Low | Low | Test against existing data before removing |
| Performance impact from on-demand extraction | Low | Low | Extraction is O(n) over small arrays, negligible |
| Breaking old videos | N/A | N/A | User confirmed: delete old videos, no migration |
| Missing edge cases in extraction | Medium | Low | Comprehensive test cases for all block types |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Storage per video | Reduced by ~5-7KB (no duplicated fields) |
| Sources of truth | 1 (content blocks only) |
| Test coverage | 100% for extraction functions |
| All workflows functional | Master summary, synthesis, memorize, chat |

---

## Required Resources

### Dependencies
- None (self-contained refactor)

### Files Changed

| File | Change |
|------|--------|
| `services/summarizer/src/utils/content_extractor.py` | **NEW** |
| `services/summarizer/src/services/llm.py` | Modify |
| `services/summarizer/src/routes/stream.py` | Modify |
| `services/summarizer/src/services/description_analyzer.py` | Modify |
| `services/explainer/src/utils/content_extractor.py` | **NEW** (copy) |
| `services/explainer/src/tools/chat_utils.py` | Modify |
| `api/src/services/memorize.service.ts` | Modify |
| `packages/types/src/index.ts` | Modify |
| `apps/web/src/components/video-detail/ChapterCard.tsx` | Modify |
| `apps/web/src/components/video-detail/ArticleSection.tsx` | Modify |
| `apps/web/src/lib/sse-validators.ts` | Modify |

---

## Verification Plan

1. **Unit Tests**: Test extraction functions with all block types
2. **Summarizer Tests**: `cd services/summarizer && pytest`
3. **API Tests**: `cd api && npm test`
4. **Type Check**: `cd packages/types && npm run build`
5. **Integration Test**: Submit new video, verify:
   - Chapters render correctly (content blocks)
   - Master summary generates correctly
   - TLDR/takeaways generate correctly
   - Memorization works
   - Chat context works in explainer
