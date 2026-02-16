# Concept Sync Fix — Plan

**Last Updated:** 2026-02-16

## Executive Summary

Playwright DOM analysis on a real video (`/video/6992e3b29431316d4a59d1e7`) reveals **~70% concept sync accuracy** — 14 of 43 sidebar concepts fail to appear as inline highlights. This task fixes identified root causes to achieve **>90% accuracy**. Builds on the completed `concepts-system-overhaul` task.

## Current State

- 43 sidebar concept entries, 202 inline highlights, 32 unique concept IDs
- 11 concepts: NOT_IN_CONTENT_AT_ALL — LLM creates names not appearing in content
- 1 concept: ComparisonRenderer labels not wrapped with ConceptHighlighter
- 1 concept: BOUNDARY regex missing `*` for markdown-formatted text
- All concepts: `getNameVariants()` called without `c.aliases` parameter

## Root Causes (verified via DOM)

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 1 | `getNameVariants(c.name)` ignores aliases | All concepts lack alias matching | S |
| 2 | BOUNDARY regex missing markdown chars `*_\`#~` | `**Validation Loop**:` fails | S |
| 3 | ComparisonRenderer labels = plain text | "User Memory (Global)" not highlighted | S |
| 4 | KeyValueRenderer values = plain text | Concept names in KV values missed | S |
| 5 | Default block fallback = plain text | Future-proofing | S |
| 6 | `extractBlockText()` misses comparison data | Sidebar matching misses comparison concepts | S |
| 7 | Self-anchoring prompt too weak | 11 concepts have names not in content | M |
| 8 | Aliases not persisted through pipeline | Backend doesn't produce aliases | M |

## Implementation

### Phase 1: Frontend Fixes (Fixes 1-6, immediate impact)

All changes are additive — cannot break existing 202 highlights.

**Fix 1-2: Pass aliases to getNameVariants** (2 files, 3 line changes)
- `ConceptHighlighter.tsx:40` — `getNameVariants(c.name, c.aliases)`
- `timestamp-utils.ts:168,182` — same pattern

**Fix 3: BOUNDARY regex** (1 line)
- `ConceptHighlighter.tsx:14` — add `*_\`#~`

**Fix 4: ComparisonRenderer labels** (3 locations)
- Lines 141, 150, 184 — wrap with `<ConceptHighlighter text={label} />`

**Fix 5: KeyValueRenderer values** (1 line + import)
- Add import, wrap `item.value`

**Fix 6: Default fallback + extractBlockText** (2 changes)
- `ContentBlockRenderer.tsx:260` — wrap text
- `timestamp-utils.ts:extractBlockText()` — add comparison label/items

### Phase 2: Backend Fixes (Fixes 7-8, addresses NOT_IN_CONTENT)

**Fix 7: Strengthen self-anchoring prompt**
- `llm.py:442-447` — replace aspiration with verification step
- Add `aliases` field to concept extraction template

**Fix 8: Persist aliases through pipeline** (3 files)
- `llm.py:merge_chapter_concepts()` — add aliases to merged dict
- `llm.py:build_concept_dicts()` — add aliases to result dict
- `mongodb_repository.py:91-100` — persist aliases field

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| BOUNDARY regex too broad | Low | Highlights unwanted text | Only adding formatting chars, never in concept names |
| LLM ignores stronger anchoring | Medium | Some concepts still unanchored | Aliases provide fallback matching |
| Aliases break SSE parsing | Low | Frontend errors | Aliases default to `[]`, backward-compatible |

## Success Metrics

- Sync accuracy: 70% → >90% (measured via Playwright DOM analysis)
- Zero regression: all 202 existing highlights still work
- All existing tests pass (1027 frontend, 41 concept backend)
