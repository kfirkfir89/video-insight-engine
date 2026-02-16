# Concept Sync Fix — Context

**Last Updated:** 2026-02-16

## Key Files

### Frontend (apps/web/)
| File | Purpose |
|------|---------|
| `src/components/video-detail/ConceptHighlighter.tsx` | Core: BOUNDARY regex (L14), variant generation (L40), inline highlight rendering |
| `src/lib/concept-utils.ts` | Shared `getNameVariants()` — generates search variants from concept names |
| `src/lib/timestamp-utils.ts` | `matchConceptsToChapters()` (L133-226), `extractBlockText()` (L66-116) |
| `src/components/video-detail/blocks/ComparisonRenderer.tsx` | Column labels at L141, 150, 184 — missing ConceptHighlighter |
| `src/components/video-detail/blocks/KeyValueRenderer.tsx` | Values at L51 — missing ConceptHighlighter |
| `src/components/video-detail/ContentBlockRenderer.tsx` | Default fallback at L260 — missing ConceptHighlighter |
| `src/components/video-detail/ConceptsContext.tsx` | React context providing concepts to all nested blocks |
| `src/components/video-detail/ArticleSection.tsx` | Orchestrates: sidebar concepts + ConceptsProvider wrapping content |

### Backend (services/summarizer/)
| File | Purpose |
|------|---------|
| `src/services/llm.py` | `merge_chapter_concepts()` L327-394, `build_concept_dicts()` L482-531, self-anchoring L442-447 |
| `src/repositories/mongodb_repository.py` | Concept persistence L91-100 — missing aliases field |
| `src/prompts/concept_extract.txt` | LLM extraction prompt (standalone path) |

### Shared Types
| File | Purpose |
|------|---------|
| `packages/types/src/index.ts:494-503` | `Concept` interface — already has `aliases?: string[]` |
| `services/summarizer/src/models/schemas.py:89-94` | Pydantic `Concept` — already has `aliases: list[str] = []` |

## Key Decisions

1. **Aliases already exist in types** but are never populated by the backend or consumed by the frontend
2. **getNameVariants() already accepts aliases** parameter — callers just don't pass it
3. **ConceptHighlighter is used in 16/32 blocks** — the 16 without it are mostly data/code blocks (correctly excluded)
4. **SSE events auto-include all dict fields** — no SSE changes needed for aliases

## Test Video for Verification

- Original (v1 cached): `http://localhost:5173/video/6992e3b29431316d4a59d1e7`
- Re-summarized (v2): `http://localhost:5173/video/6992f1be9431316d4a59d1e9`
- Title: "How I use Claude Code (Meta Staff Engineer Tips)"
- 55 chapters, 43 sidebar concepts
- v1: 214 inline highlights, 77% accuracy (33/43 synced)
- v2: 277 inline highlights, **93% accuracy** (40/43 synced)

## Playwright DOM Analysis Script

Run this in browser console or via Playwright evaluate to measure sync accuracy:
```javascript
// Count sidebar concepts vs inline highlights per chapter
document.querySelectorAll('[data-slot="article-chapter"]').forEach(article => {
  const title = article.querySelector('h3')?.textContent;
  const sidebar = article.querySelectorAll('button[id^="concept-btn-"]');
  const inline = article.querySelectorAll('[data-concept-id]');
  // Compare sidebar concept names against inline highlight texts
});
```

## Dependencies

- Builds on completed `concepts-system-overhaul` task (14/14 done)
- No external dependencies
- Frontend and backend phases are independent
