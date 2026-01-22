# Master Summary Feature - Context

**Last Updated:** 2026-01-22

---

## Key Files

### Backend (vie-summarizer)

| File | Purpose | Modification Type |
|------|---------|-------------------|
| `services/summarizer/src/prompts/master_summary.txt` | Master summary prompt template | **CREATE** |
| `services/summarizer/src/services/llm.py` | LLM service - add `generate_master_summary()` | MODIFY |
| `services/summarizer/src/routes/stream.py` | SSE pipeline - add Phase 5 | MODIFY |
| `services/summarizer/src/models/schemas.py` | Add master_summary to VideoSummary | MODIFY |
| `services/summarizer/src/repositories/mongodb_repository.py` | Ensure master_summary saved | VERIFY |

### Shared Types

| File | Purpose | Modification Type |
|------|---------|-------------------|
| `packages/types/src/index.ts` | Add masterSummary to VideoSummary interface | MODIFY |

### API (vie-api)

| File | Purpose | Modification Type |
|------|---------|-------------------|
| `api/src/services/video.service.ts` | Verify masterSummary pass-through | VERIFY |

### Frontend (vie-web)

| File | Purpose | Modification Type |
|------|---------|-------------------|
| `apps/web/src/components/video-detail/VideoDetailLayout.tsx` | Add Quick Read button | MODIFY |
| `apps/web/src/components/video-detail/MasterSummaryModal.tsx` | Modal for displaying summary | **CREATE** |
| `apps/web/src/hooks/use-summary-stream.ts` | Handle SSE event | MODIFY |

---

## Key Decisions Made

### 1. Master Summary Placement in Pipeline

**Decision:** Generate AFTER concepts extraction (Phase 5)

**Rationale:**
- Master summary needs all processed data as input
- Not time-critical for UX (user sees sections progressively)
- Can be generated while concepts are displayed

### 2. Storage Location

**Decision:** `summary.masterSummary` field (same level as `tldr`, `sections`, etc.)

**Rationale:**
- Logically part of the summary structure
- Easy to access from existing API responses
- Optional field for backward compatibility

### 3. UI Trigger

**Decision:** Icon button in video header metadata row (near duration/status)

**Rationale:**
- Discoverable but not dominant
- Near existing metadata
- Simple icon (FileText/BookOpen) with "Quick Read" label

### 4. Display Format

**Decision:** Modal dialog with markdown rendering

**Rationale:**
- Non-intrusive (doesn't leave current view)
- Markdown allows rich formatting
- Easy to close and return to main content

### 5. Naming Convention

**Decision:** "Quick Read" for user-facing, "Master Summary" for internal/technical

**Rationale:**
- "Quick Read" is user-friendly and descriptive
- "Master Summary" accurately describes technical purpose (AI context)

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MASTER SUMMARY DATA FLOW                          │
└─────────────────────────────────────────────────────────────────────┘

After Phase 4 (Concepts Complete):

┌─────────────────────────┐
│  Available Data:        │
│  • title                │
│  • channel              │
│  • duration             │
│  • persona              │
│  • tldr                 │
│  • key_takeaways[]      │
│  • sections[] (with     │
│    content blocks)      │
│  • concepts[] (with     │
│    definitions)         │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  generate_master_       │
│  summary()              │
│                         │
│  • Format sections text │
│  • Format concepts text │
│  • Build prompt         │
│  • Call Claude Sonnet   │
│  • Return markdown      │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│  SSE Event:             │────▶│  Frontend State:        │
│  master_summary_complete│     │  summary.masterSummary  │
│  { masterSummary: "..." }│     │  = markdown content     │
└─────────────────────────┘     └───────────┬─────────────┘
                                            │
                                            ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│  MongoDB:               │     │  UI:                    │
│  videoSummaryCache      │     │  Quick Read button      │
│  .summary.masterSummary │     │  appears in header      │
└─────────────────────────┘     └─────────────────────────┘
```

---

## Existing Patterns to Follow

### SSE Event Pattern (from stream.py)

```python
# Example from existing code
yield sse_event("concepts_complete", {"concepts": concepts})

# New event should follow same pattern
yield sse_event("master_summary_complete", {"masterSummary": master_summary})
```

### LLM Method Pattern (from llm.py)

```python
# Example from existing generate_metadata_tldr()
async def generate_metadata_tldr(
    self,
    title: str,
    description: str,
    chapter_titles: list[str],
) -> dict:
    prompt = load_prompt("metadata_tldr").format(
        title=title,
        description=description[:500] if description else "Not available",
        chapters=chapters_text,
    )
    text = await self._call_llm(prompt, max_tokens=500)
    return _parse_json_response(text, {"tldr": "", "keyTakeaways": []})
```

### Modal Pattern (from existing dialogs)

Reference: `apps/web/src/components/videos/VideoPlayerModal.tsx`

```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="...">
    <DialogHeader>
      <DialogTitle>...</DialogTitle>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

---

## Dependencies

### NPM Packages (Already in Project)

- `@radix-ui/react-dialog` - Dialog component (via shadcn/ui)
- `react-markdown` - Markdown rendering (verify if installed)
- `lucide-react` - Icons (FileText, BookOpen)

### External Services

- Claude Sonnet API (Anthropic) - For LLM generation

---

## Testing Strategy

### Unit Tests

1. **LLM Service**: Test `generate_master_summary()` with mock data
2. **Prompt Template**: Verify correct variable substitution

### Integration Tests

1. **Stream Pipeline**: Verify master_summary event emitted
2. **MongoDB**: Verify masterSummary field saved correctly

### Manual Testing

1. Re-summarize a video with bypassCache=true
2. Verify "Quick Read" button appears
3. Click button, verify modal shows formatted markdown
4. Test on video without masterSummary (button should not appear)

---

## Related Documentation

- [SUMMARIZATION-FLOW.md](/SUMMARIZATION-FLOW.md) - Current pipeline details
- [PLAN-VIDEO-CONTEXT.md](/PLAN-VIDEO-CONTEXT.md) - Persona system (used in prompt)
- [PLAN-DYNAMIC-CONTENT-BLOCKS.md](/PLAN-DYNAMIC-CONTENT-BLOCKS.md) - Content block types
- [docs/DATA-MODELS.md](/docs/DATA-MODELS.md) - MongoDB schema reference
- [docs/SERVICE-SUMMARIZER.md](/docs/SERVICE-SUMMARIZER.md) - Summarizer service docs
