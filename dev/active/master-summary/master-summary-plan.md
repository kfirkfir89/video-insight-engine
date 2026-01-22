# Master Summary Feature Plan

**Last Updated:** 2026-01-22

---

## Executive Summary

Add a "Master Summary" to the video summarization pipeline - a comprehensive, AI-optimized summary generated as the final step after all sections and concepts are processed. This master summary will serve as dense context for future AI features while also providing users with a "quick read" option via a modal accessible from the video detail header.

---

## Current State Analysis

### Existing Summarization Flow (from SUMMARIZATION-FLOW.md)

```
PHASE 1: Metadata (~1-3s)     → title, channel, chapters, transcript
PHASE 2: Parallel (~2-5s)     → description_analysis, metadata_tldr, first_section
PHASE 3: Sections (~3-5s/batch) → section summaries with content blocks
PHASE 4: Concepts (~3-5s)     → key terms with definitions
PHASE 5: Save & Done          → persist to MongoDB
```

### Current TLDR Generation

The current `tldr` is generated from **metadata only** (title, description, chapter titles) via `generate_metadata_tldr()`. It's fast (~2-3s) but lacks depth from actual content.

### Missing Capability

There is NO summary that synthesizes:
- All section summaries (with deep content blocks)
- All extracted concepts with definitions
- Key takeaways
- Full transcript context
- Video persona/category

This comprehensive synthesis is exactly what the "Master Summary" will provide.

---

## Proposed Future State

### New Summarization Flow

```
PHASE 1: Metadata (~1-3s)     → title, channel, chapters, transcript
PHASE 2: Parallel (~2-5s)     → description_analysis, metadata_tldr, first_section
PHASE 3: Sections (~3-5s/batch) → section summaries with content blocks
PHASE 4: Concepts (~3-5s)     → key terms with definitions
PHASE 5: MASTER SUMMARY (~3-5s) → comprehensive AI-optimized summary  ← NEW
PHASE 6: Save & Done          → persist to MongoDB (including master_summary)
```

### Master Summary Characteristics

| Aspect | Requirement |
|--------|-------------|
| **Input** | All sections, concepts, key_takeaways, transcript excerpt, persona |
| **Output** | Compact markdown (500-800 words), structured for AI consumption |
| **Purpose** | Context for future AI features (explain, chat, search, recommendations) |
| **User Access** | "Quick Read" button → modal display |
| **Storage** | `summary.masterSummary` field in videoSummaryCache |

### Data Model Addition

```typescript
interface VideoSummary {
  tldr: string;
  keyTakeaways: string[];
  sections: Section[];
  concepts: Concept[];
  masterSummary?: string;  // NEW: Comprehensive markdown summary
}
```

---

## Implementation Phases

### Phase 1: Backend - Master Summary Generation

**Files to modify:**
- `services/summarizer/src/prompts/master_summary.txt` (NEW)
- `services/summarizer/src/services/llm.py`
- `services/summarizer/src/routes/stream.py`

**Approach:**
1. Create new prompt template that receives all processed data
2. Add `generate_master_summary()` method to LLMService
3. Call after concepts extraction, before final save
4. Emit SSE event `master_summary_complete`

### Phase 2: Backend - Data Model & Storage

**Files to modify:**
- `services/summarizer/src/models/schemas.py`
- `services/summarizer/src/repositories/mongodb_repository.py`

**Approach:**
1. Add `masterSummary: str | None` to VideoSummary schema
2. Include in final result dict saved to MongoDB

### Phase 3: Shared Types

**Files to modify:**
- `packages/types/src/index.ts`

**Approach:**
1. Add `masterSummary?: string` to VideoSummary interface
2. Export for use in API and frontend

### Phase 4: API Layer

**Files to modify:**
- `api/src/services/video.service.ts` (verify pass-through)

**Approach:**
1. Ensure masterSummary is included in video response (likely automatic with spread)

### Phase 5: Frontend - Quick Read Button

**Files to modify:**
- `apps/web/src/components/video-detail/VideoDetailLayout.tsx`

**Approach:**
1. Add icon button (BookOpen or FileText) near duration/status row
2. Only show when `summary.masterSummary` exists
3. Button triggers modal open

### Phase 6: Frontend - Master Summary Modal

**Files to create:**
- `apps/web/src/components/video-detail/MasterSummaryModal.tsx` (NEW)

**Approach:**
1. Create dialog component using shadcn/ui Dialog
2. Display markdown content with proper formatting
3. Include video title in header
4. Add close button

---

## Detailed Tasks

### 1. Backend: Create Master Summary Prompt

**File:** `services/summarizer/src/prompts/master_summary.txt`

```
You are creating a comprehensive knowledge document from a video summary.

VIDEO METADATA:
Title: {title}
Channel: {channel}
Duration: {duration_formatted}
Persona: {persona}

TLDR: {tldr}

KEY TAKEAWAYS:
{key_takeaways}

SECTIONS:
{sections_detailed}

KEY CONCEPTS:
{concepts_detailed}

---

Create a MASTER SUMMARY document that:
1. Captures EVERY significant insight from the video
2. Is structured for easy AI retrieval and context
3. Uses clear markdown formatting
4. Is comprehensive yet concise (500-800 words)

Format the output as markdown with:
- ## Overview (2-3 sentences capturing the core message)
- ## Key Insights (bullet points of main learnings)
- ## Detailed Breakdown (organized by topic/section)
- ## Concepts & Definitions (key terms explained)
- ## Actionable Takeaways (what to do with this knowledge)

Write directly - no preamble or meta-commentary.
```

**Effort:** S

### 2. Backend: Add LLM Method for Master Summary

**File:** `services/summarizer/src/services/llm.py`

Add method:
```python
async def generate_master_summary(
    self,
    title: str,
    channel: str,
    duration: int,
    persona: str,
    tldr: str,
    key_takeaways: list[str],
    sections: list[dict],
    concepts: list[dict],
) -> str:
    """Generate comprehensive master summary from all video data."""
```

**Effort:** M

### 3. Backend: Integrate into Stream Pipeline

**File:** `services/summarizer/src/routes/stream.py`

After concepts extraction, before save:
```python
# Phase 5: Master Summary
yield sse_event("phase", {"phase": "master_summary"})

master_summary = await llm_service.generate_master_summary(
    title=video_data.title,
    channel=video_data.channel,
    duration=video_data.duration,
    persona=persona,
    tldr=synthesis_result["tldr"],
    key_takeaways=synthesis_result["keyTakeaways"],
    sections=sections,
    concepts=concepts,
)

yield sse_event("master_summary_complete", {"masterSummary": master_summary})
```

**Effort:** M

### 4. Backend: Update Schema & Storage

**File:** `services/summarizer/src/models/schemas.py`

```python
class VideoSummary(BaseModel):
    tldr: str
    key_takeaways: list[str]
    sections: list[Section]
    concepts: list[Concept]
    master_summary: str | None = None  # NEW
```

**Effort:** S

### 5. Types: Add masterSummary to VideoSummary

**File:** `packages/types/src/index.ts`

```typescript
export interface VideoSummary {
  tldr: string;
  keyTakeaways: string[];
  sections: Section[];
  concepts: Concept[];
  masterSummary?: string;  // NEW
}
```

**Effort:** S

### 6. Frontend: Add Quick Read Button

**File:** `apps/web/src/components/video-detail/VideoDetailLayout.tsx`

In the header metadata row (near duration/status):
```tsx
{summary?.masterSummary && (
  <Button
    variant="ghost"
    size="sm"
    onClick={() => setShowMasterSummary(true)}
    className="gap-1.5"
  >
    <FileText className="h-4 w-4" />
    Quick Read
  </Button>
)}
```

**Effort:** S

### 7. Frontend: Create Master Summary Modal

**File:** `apps/web/src/components/video-detail/MasterSummaryModal.tsx` (NEW)

```tsx
interface MasterSummaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  content: string;
}

export function MasterSummaryModal({ open, onOpenChange, title, content }: MasterSummaryModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title} - Quick Read</DialogTitle>
        </DialogHeader>
        <div className="prose prose-sm dark:prose-invert">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Effort:** M

### 8. Frontend: Handle SSE Event (if streaming)

**File:** `apps/web/src/hooks/use-summary-stream.ts`

Handle `master_summary_complete` event during streaming:
```typescript
case 'master_summary_complete':
  setSummary(prev => prev ? {
    ...prev,
    masterSummary: data.masterSummary
  } : null);
  break;
```

**Effort:** S

---

## Risk Assessment & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Master summary adds ~3-5s to processing | Medium | High | Acceptable - runs after all user-visible content |
| Token limits exceeded for long videos | Medium | Low | Truncate sections input, focus on summaries not full content |
| Markdown rendering issues | Low | Low | Use battle-tested ReactMarkdown with prose styling |
| Backward compatibility with existing videos | Medium | High | Field is optional, UI checks before showing button |

---

## Success Metrics

1. **Completeness**: Master summary covers all major points from sections
2. **Conciseness**: Output is 500-800 words as specified
3. **AI Utility**: Summary provides good context when used in future explain/chat features
4. **UX**: Button appears only when summary exists, modal is readable and dismissible
5. **Performance**: Adds ≤5 seconds to total processing time

---

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| Existing summarization pipeline | Internal | Must complete sections + concepts first |
| ReactMarkdown | NPM | For rendering markdown in modal |
| shadcn/ui Dialog | NPM | Already in project |
| Claude Sonnet API | External | For LLM generation |

---

## Timeline Estimate

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 1: Backend prompt + LLM method | M | P0 |
| Phase 2: Backend pipeline integration | M | P0 |
| Phase 3: Data model updates | S | P0 |
| Phase 4: Types update | S | P0 |
| Phase 5: Quick Read button | S | P0 |
| Phase 6: Modal component | M | P0 |
| Phase 7: SSE event handling | S | P1 |

**Total Effort:** Medium-Large
