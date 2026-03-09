# Summarizer Block Architecture - Context

**Last Updated:** 2026-02-04

---

## Key Files Reference

### Python Summarizer Service

| File | Purpose | Key Lines |
|------|---------|-----------|
| `services/summarizer/src/models/schemas.py` | Pydantic models | Section class ~L73-95 |
| `services/summarizer/src/services/llm.py` | LLM orchestration | 826 lines, detect_sections ~L264-292, summarize_section ~L294-357 |
| `services/summarizer/src/routes/stream.py` | SSE streaming | 929 lines, build_section_dict ~L296-321, SSE events throughout |
| `services/summarizer/src/prompts/section_detect.txt` | Section detection prompt | To be renamed |
| `services/summarizer/src/prompts/section_summary.txt` | Section summary prompt | To be renamed |
| `services/summarizer/src/prompts/master_summary.txt` | Master summary prompt | Contains "sections" reference |

### TypeScript Types Package

| File | Purpose | Key Lines |
|------|---------|-----------|
| `packages/types/src/index.ts` | Shared types | Section ~L164-176, ContentBlock union ~L121-132, VideoContext ~L42-47, SSE events ~L411-502 |

### API Layer (Node.js)

| File | Purpose |
|------|---------|
| `api/src/repositories/video.repository.ts` | MongoDB operations, types |
| `api/src/routes/video.routes.ts` | SSE proxy handling |

### Frontend (React)

| File | Purpose |
|------|---------|
| `apps/web/src/hooks/use-summary-stream.ts` | SSE event handling |
| `apps/web/src/hooks/use-active-section.ts` | Active section tracking |
| `apps/web/src/components/video-detail/SectionCard.tsx` | Section display |
| `apps/web/src/components/video-detail/ArticleSection.tsx` | Article-style section |
| `apps/web/src/components/video-detail/ContentBlockRenderer.tsx` | Block rendering |
| `apps/web/src/components/video-detail/views/*.tsx` | Persona-specific views |

---

## Current Type Definitions

### Section (to become Chapter)

```typescript
// packages/types/src/index.ts ~L164-176
export interface Section {
  id: string;
  timestamp: string;
  startSeconds: number;
  endSeconds: number;
  title: string;
  originalTitle?: string;
  generatedTitle?: string;
  isCreatorChapter?: boolean;
  content?: ContentBlock[];
  summary: string;          // Legacy
  bullets: string[];        // Legacy
}
```

### ContentBlock (needs blockId)

```typescript
// Current - NO blockId
export interface ParagraphBlock {
  type: 'paragraph';
  variant?: string;
  text: string;
}

// Target - WITH blockId
export interface BaseBlock {
  blockId: string;  // UUID
  type: string;
  variant?: string;
}

export interface ParagraphBlock extends BaseBlock {
  type: 'paragraph';
  text: string;
}
```

### VideoContext (persona removal)

```typescript
// Current
export interface VideoContext {
  youtubeCategory: string;
  persona: VideoPersona;  // To be removed from storage
  tags: string[];
  displayTags: string[];
}

// Target
export interface VideoContext {
  category: string;          // User-facing: "cooking", "coding"
  youtubeCategory: string;
  tags: string[];
  displayTags: string[];
}
```

---

## SSE Event Names

### Current Events

| Event | Payload |
|-------|---------|
| `section_ready` | `{ index, section }` |
| `metadata` | `{ title, channel, duration, thumbnailUrl }` |
| `chapters` | `{ chapters: [...] }` |
| `synthesis_complete` | `{ tldr, keyTakeaways }` |
| `concepts_complete` | `{ concepts: [...] }` |
| `done` | `{ summary, processingTimeMs }` |

### Target Events

| Event | Payload |
|-------|---------|
| `chapter_ready` | `{ index, chapter }` |
| `chapters_detected` | `{ count, chapters: [...] }` |
| (others unchanged) | |

---

## Function Rename Map

### Python (services/summarizer)

| Current | New |
|---------|-----|
| `detect_sections()` | `detect_chapters()` |
| `summarize_section()` | `summarize_chapter()` |
| `stream_detect_sections()` | `stream_detect_chapters()` |
| `stream_summarize_section()` | `stream_summarize_chapter()` |
| `build_section_dict()` | `build_chapter_dict()` |
| `process_creator_sections()` | `process_creator_chapters()` |
| `process_ai_sections()` | `process_ai_chapters()` |

### TypeScript (apps/web)

| Current | New |
|---------|-----|
| `SectionCard.tsx` | `ChapterCard.tsx` |
| `ArticleSection.tsx` | `ArticleChapter.tsx` |
| `use-active-section.ts` | `use-active-chapter.ts` |

---

## Persona to Category Mapping

```python
# Internal mapping (not stored)
PERSONA_TO_CATEGORY = {
    'code': 'coding',
    'recipe': 'cooking',
    'interview': 'podcast',
    'review': 'reviews',
    'standard': 'standard',
}
```

**Usage pattern:**
1. Detect persona from video metadata (unchanged)
2. Use persona internally for LLM prompt selection
3. Store category (mapped from persona) in VideoContext
4. Persona is NEVER returned in API responses

---

## Key Decisions

### Decision 1: Section → Chapter Rename

**Rationale:**
- Aligns with YouTube terminology (creator chapters)
- More intuitive for users
- Matches the `isCreatorChapter` flag already in use

### Decision 2: Add blockId to All Blocks

**Rationale:**
- Enables stable referencing for memorization
- Allows RAG to point to specific blocks
- UUIDs are collision-free and stable

### Decision 3: Remove persona from Storage

**Rationale:**
- Persona is an implementation detail
- Users care about category, not internal prompt tuning
- Reduces coupling between LLM details and stored data

### Decision 4: Database Reset (No Migration)

**Rationale:**
- Clean break is simpler than migration
- Project is in development phase
- Regenerating summaries ensures consistent data

---

## Test Files to Update

### Python Tests

| File | Purpose |
|------|---------|
| `services/summarizer/tests/test_stream_routes.py` | Stream route tests |
| `services/summarizer/tests/test_llm.py` | LLM service tests |
| `services/summarizer/tests/test_schemas.py` | Schema validation tests |

### TypeScript Tests

| File | Purpose |
|------|---------|
| `apps/web/src/hooks/__tests__/use-summary-stream.test.ts` | SSE hook tests |
| `apps/web/src/stores/__tests__/processing-store.test.ts` | Store tests |
| `apps/web/src/lib/__tests__/sse-validators.test.ts` | Validator tests |
| `api/src/**/*.test.ts` | API tests |

---

## Dependencies & Build Order

```
1. packages/types      # Types first - others depend on it
2. services/summarizer # Python service (independent)
3. api                 # Node.js API (depends on types)
4. apps/web            # Frontend (depends on types + api)
```

**Build commands:**
```bash
# 1. Types
cd packages/types && pnpm build

# 2. Summarizer (Python)
cd services/summarizer && python -m pytest

# 3. API
cd api && pnpm build && pnpm test

# 4. Web
cd apps/web && pnpm build && pnpm test
```

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| `docs/DATA-MODELS.md` | MongoDB schemas, ContentBlock types |
| `docs/SERVICE-SUMMARIZER.md` | Summarizer service documentation |
| `docs/API-REFERENCE.md` | API endpoints and SSE events |
| `docs/ARCHITECTURE.md` | System architecture |

**Note:** These docs will need updating after implementation.
