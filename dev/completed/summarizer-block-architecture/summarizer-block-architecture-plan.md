# Summarizer Service: Block-Driven Architecture Update

**Last Updated:** 2026-02-04
**Priority:** HIGH - Must be completed BEFORE Memorize/RAG plan
**Service:** `services/summarizer/`
**Breaking Change:** YES - Database will be reset (no migration)

---

## Executive Summary

Update the summarizer service to output block-driven chapter data with stable identifiers:

1. **RENAME** all `section` references → `chapter` (code, prompts, types, SSE events)
2. **ADD** `blockId` (UUID) to each ContentBlock for stable referencing
3. **CLARIFY** persona vs category (persona = internal LLM only, category = stored)
4. **RESET** database - no backwards compatibility required

This is a foundational change that enables future memorization and RAG features by providing stable block identifiers.

---

## Current State Analysis

### Terminology Analysis

The codebase currently uses **"section"** as the primary term for video content divisions:

| Location | Current Term | Occurrences |
|----------|--------------|-------------|
| Python schemas | `Section` | models/schemas.py |
| Python services | `summarize_section()`, `detect_sections()` | services/llm.py |
| Python routes | `build_section_dict()`, `process_*_sections()` | routes/stream.py |
| TypeScript types | `Section` interface | packages/types/src/index.ts |
| Frontend components | `SectionCard`, `ArticleSection` | apps/web/src/components/ |
| SSE events | `section_ready` | Multiple files |
| Prompt files | `section_detect.txt`, `section_summary.txt` | prompts/ |

### ContentBlock Analysis

**Current state:** ContentBlocks have NO `blockId` field. Blocks are identified by array index only.

**Problem:** Array indices are unstable - if block order changes, references break.

**Solution:** Add `blockId: string` (UUID) to every content block.

### Persona vs Category Analysis

**Current state:** `persona` is stored in `VideoContext` and exposed externally.

**Plan change:**
- `persona` = internal LLM prompt modifier only (not stored)
- `category` = user-facing classification (stored in VideoContext)

---

## Proposed Future State

### 1. Terminology: Section → Chapter

All references to "section" become "chapter" to align with YouTube terminology and user expectations.

### 2. ContentBlock with blockId

```typescript
interface BaseBlock {
  blockId: string;  // UUID - stable identifier
  type: string;
  variant?: string;
}
```

### 3. VideoContext Simplified

```typescript
interface VideoContext {
  category: string;          // User-facing: "cooking", "coding", etc.
  youtubeCategory: string;   // YouTube's category
  tags: string[];
  displayTags: string[];
  // NO persona field - internal only
}
```

### 4. Chapter Structure

```typescript
interface Chapter {
  id: string;
  timestamp: string;
  startSeconds: number;
  endSeconds: number;
  title: string;
  originalTitle?: string;
  generatedTitle?: string;
  isCreatorChapter?: boolean;
  blocks: ContentBlock[];  // With blockId
}
```

---

## Implementation Phases

### Phase 1: Prompt Files (Effort: S)

Rename and update LLM prompt files to use "chapter" terminology.

**Files to change:**
- `prompts/section_detect.txt` → `prompts/chapter_detect.txt`
- `prompts/section_summary.txt` → `prompts/chapter_summary.txt`
- `prompts/master_summary.txt` (update internal references)

**Acceptance criteria:**
- [ ] Files renamed
- [ ] Content updated with "chapter" terminology
- [ ] JSON output schema uses "chapters" array

---

### Phase 2: TypeScript Types (Effort: M)

Update shared types package for chapter/block changes.

**Files to change:**
- `packages/types/src/index.ts`

**Changes:**
1. Add `BaseBlock` interface with `blockId`
2. Update all block types to extend `BaseBlock`
3. Rename `Section` → `Chapter`
4. Update `VideoSummary.sections` → `VideoSummary.chapters`
5. Update `VideoContext` (remove persona, keep category)
6. Update SSE event types (`section_ready` → `chapter_ready`)

**Acceptance criteria:**
- [ ] All block types have `blockId: string`
- [ ] `Section` interface removed, `Chapter` exists
- [ ] `VideoContext` has `category`, not `persona`
- [ ] `pnpm build` passes in packages/types

---

### Phase 3: Python Summarizer (Effort: L)

Core backend changes to schemas, services, and routes.

#### 3.1 Schema Updates

**File:** `services/summarizer/src/models/schemas.py`

- Rename `Section` → `Chapter`
- Add `blockId` injection logic reference

#### 3.2 LLM Service Updates

**File:** `services/summarizer/src/services/llm.py`

- Rename `summarize_section()` → `summarize_chapter()`
- Rename `detect_sections()` → `detect_chapters()`
- Add `inject_block_ids()` function
- Update prompt loading to use new filenames
- Ensure `blockId` is added to every content block

#### 3.3 Stream Route Updates

**File:** `services/summarizer/src/routes/stream.py`

- Rename all functions: `build_section_dict()` → `build_chapter_dict()`
- Rename variables: `sections` → `chapters`
- Update SSE event names: `section_ready` → `chapter_ready`
- Update `build_result()` to use `chapters`
- Implement `extract_context()` for persona→category mapping

**Acceptance criteria:**
- [ ] All "section" renamed to "chapter" in Python
- [ ] `inject_block_ids()` adds UUID to each block
- [ ] SSE events use `chapter_ready`, `chapters_detected`
- [ ] Python tests pass

---

### Phase 4: API Layer (Effort: M)

Update Node.js API to handle new types.

**Files to change:**
- `api/src/repositories/video.repository.ts`
- `api/src/routes/video.routes.ts`
- Related test files

**Changes:**
1. Update `VideoSummaryCacheDocument` types
2. Update SSE event handling
3. Ensure `chapters` flows through correctly

**Acceptance criteria:**
- [ ] Repository types updated
- [ ] SSE proxy handles new event names
- [ ] API tests pass

---

### Phase 5: Frontend (Effort: L)

Update React components and hooks.

#### 5.1 Type Imports

All files importing `Section` → import `Chapter`

#### 5.2 Component Renames

| Current | New |
|---------|-----|
| `SectionCard.tsx` | `ChapterCard.tsx` |
| `ArticleSection.tsx` | `ArticleChapter.tsx` |
| `use-active-section.ts` | `use-active-chapter.ts` |

#### 5.3 Hook Updates

**File:** `apps/web/src/hooks/use-summary-stream.ts`

- Handle `chapter_ready` event
- Update state variables

**Acceptance criteria:**
- [ ] All `Section` → `Chapter` imports
- [ ] Components renamed and props updated
- [ ] Hooks handle new SSE events
- [ ] Frontend builds and renders correctly

---

### Phase 6: Database Reset (Effort: S)

Create and run database reset script.

**File to create:** `scripts/reset-database.ts`

**Collections to drop:**
- `videoSummaryCache`
- `memorizedItems`
- `userVideos`
- `systemExpansionCache`
- `userChats`

**Keep:** `users` collection

**Acceptance criteria:**
- [ ] Script created
- [ ] Script runs successfully
- [ ] Collections dropped, users preserved

---

### Phase 7: End-to-End Testing (Effort: M)

Verify complete flow works.

**Test cases:**
1. Submit a new video for summarization
2. Verify chapters are generated with `blockId` on each block
3. Verify SSE events use `chapter_ready`
4. Verify `context.category` is populated (not persona)
5. Verify frontend renders chapters correctly

**Acceptance criteria:**
- [ ] New video summarization completes
- [ ] All blocks have `blockId`
- [ ] Frontend displays chapters
- [ ] No "section" strings in runtime data

---

## Risk Assessment

### Risk 1: Breaking Changes

**Impact:** HIGH
**Mitigation:** Database reset planned, no migration needed

### Risk 2: Frontend Component Coupling

**Impact:** MEDIUM
**Likelihood:** MEDIUM
**Mitigation:** Search comprehensively for all Section references

### Risk 3: SSE Event Compatibility

**Impact:** MEDIUM
**Likelihood:** LOW
**Mitigation:** Update all consumers simultaneously

### Risk 4: Test Coverage

**Impact:** MEDIUM
**Likelihood:** MEDIUM
**Mitigation:** Run all test suites before and after each phase

---

## Success Metrics

| Metric | Target |
|--------|--------|
| "section" string occurrences | 0 (excluding comments/docs) |
| ContentBlocks with blockId | 100% |
| SSE events updated | 100% |
| Test pass rate | 100% |
| Build success | All packages/services |

---

## Verification Checklist (Final)

```bash
# No "section" in code (excluding docs/comments)
grep -r "section" --include="*.ts" --include="*.tsx" --include="*.py" \
  services/summarizer/src api/src apps/web/src packages/types/src \
  | grep -v "// section" | grep -v "# section" | wc -l
# Expected: 0

# All blocks have blockId in output
# Test by summarizing a video and checking JSON

# Build all services
pnpm build
cd services/summarizer && python -m pytest

# End-to-end test
# Manual: Submit video, verify frontend renders chapters
```

---

## Dependencies

| Dependency | Required For |
|------------|--------------|
| None | This is a foundational change |

## Blocked By

Nothing - this is the first step.

## Blocks

- Memorize/RAG implementation (needs stable blockId)
- Collections feature (needs chapter structure)

---

## File Changes Summary

| File | Action | Effort |
|------|--------|--------|
| `prompts/section_detect.txt` | RENAME + EDIT | S |
| `prompts/section_summary.txt` | RENAME + EDIT | S |
| `prompts/master_summary.txt` | EDIT | S |
| `packages/types/src/index.ts` | EDIT (major) | M |
| `services/summarizer/src/models/schemas.py` | EDIT | S |
| `services/summarizer/src/services/llm.py` | EDIT (major) | M |
| `services/summarizer/src/routes/stream.py` | EDIT (major) | L |
| `api/src/repositories/video.repository.ts` | EDIT | M |
| `api/src/routes/video.routes.ts` | EDIT | M |
| `apps/web/src/hooks/use-summary-stream.ts` | EDIT | M |
| `apps/web/src/components/video-detail/*` | EDIT + RENAME | L |
| `scripts/reset-database.ts` | CREATE | S |

**Total estimated files:** 20-30 files
**Total estimated effort:** L (Large)
