# Frontend TypeScript Error Fixes - Context

**Last Updated:** 2026-02-04

---

## Key Files

| File | Purpose | Action |
|------|---------|--------|
| `packages/types/src/index.ts` | Shared type definitions | Add `Chapter` type alias |
| `apps/web/src/components/video-detail/VideoDetailLayout.tsx` | Video detail orchestrator | Fix section→chapter refs |
| `apps/web/src/hooks/use-summary-stream.ts` | SSE streaming hook | Imports `Chapter` type |

---

## Type Relationships

```
@vie/types
├── SummaryChapter (full chapter with content)
│   ├── id: string
│   ├── timestamp: string
│   ├── startSeconds: number
│   ├── endSeconds: number
│   ├── title: string
│   ├── originalTitle?: string
│   ├── generatedTitle?: string
│   ├── isCreatorChapter?: boolean  ← Optional
│   ├── content?: ContentBlock[]
│   ├── summary: string
│   └── bullets: string[]
│
├── StreamingChapter (simplified for streaming)
│   ├── startSeconds: number
│   ├── endSeconds: number
│   ├── title: string
│   └── isCreatorChapter: boolean   ← Required
│
└── Chapter = StreamingChapter (NEW alias to add)
```

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-04 | `Chapter = StreamingChapter` | Used in progressive streaming context, not full summaries |
| 2026-02-04 | Fix in VideoDetailLayout only | Other files use correct chapter refs |

---

## Related Tasks

- `frontend-refactor` (completed) - Original section→chapter rename
- This task completes the migration

---

## Search Results

### Files importing `Chapter` from @vie/types

1. `apps/web/src/hooks/use-summary-stream.ts` - line 27
2. `apps/web/src/components/video-detail/VideoDetailLayout.tsx` - line 18

### Remaining "section" references in web app

Only in `VideoDetailLayout.tsx`:
- Line 61: `summary?.sections`
- Line 63: `summary?.sections`
- Line 75: `matchConceptsToSections`
- Line 76: `summary.sections`
