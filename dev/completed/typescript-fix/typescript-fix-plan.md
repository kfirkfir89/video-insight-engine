# Frontend TypeScript Error Fixes Plan

**Last Updated:** 2026-02-04
**Status:** In Progress
**Priority:** Critical (blocking build)

---

## Executive Summary

Extensive TypeScript errors in the frontend related to incomplete section→chapter rename refactoring, missing type definitions, and type mismatches. This task fixes all compilation errors to restore a working build.

---

## Current State Analysis

### Root Causes Identified

#### 1. Incomplete Section→Chapter Rename

Files with stale "section" references:
- `VideoDetailDesktop.tsx` - `summary.sections`, `section`, `activePlaySection`, etc.
- `VideoDetailMobile.tsx` - `summary.sections`, `section`, `activePlaySection`, etc.
- `ArticleSection.tsx` - `Section` import, `section` variable
- All view files (DIYView, TravelView, etc.) - import `Section` type

#### 2. Missing Type Exports from @vie/types

- `Section` - Renamed to `SummaryChapter`, need alias
- Block types not being found (may be package build issue)

#### 3. Type Mismatches

- `VideoContext.category` was `string`, changed to `VideoCategory`
- `SummaryChapter.isCreatorChapter` is optional, `StreamingChapter` requires it
- SSE validators return wrong type for category

#### 4. Missing Dependencies

- `@radix-ui/react-popover` - Not installed

#### 5. Fixed Issues (Completed)

- [x] `VideoContext` duplicate category field
- [x] `Chapter` type alias added
- [x] `VideoDetailLayout.tsx` section→chapter refs

---

## Implementation Plan

### Phase 1: Add Missing Type Aliases (DONE)

- [x] Add `Chapter = StreamingChapter` type alias
- [x] Fix `VideoContext` duplicate category field

### Phase 2: Add Section Type Alias

Add backward-compatible alias for Section:

```typescript
/** @deprecated Use SummaryChapter instead */
export type Section = SummaryChapter;
```

### Phase 3: Fix VideoDetailDesktop.tsx

Replace all section references with chapter:
- `summary.sections` → `summary.chapters`
- `section` variable → `chapter`
- `activePlaySection` → `activePlayChapter`
- `scrollToSection` → `scrollToChapter`
- `handlePlayFromSection` → `handlePlayFromChapter`
- `handleStopSection` → `handleStopChapter`

### Phase 4: Fix VideoDetailMobile.tsx

Same pattern as Desktop.

### Phase 5: Fix ArticleSection.tsx

- Remove unused `Section` import
- Add `SummaryChapter` import
- Fix `section` variable to `chapter`

### Phase 6: Fix View Components

Update all view files (TravelView, ReviewView, etc.) to:
- Import `SummaryChapter` instead of `Section`
- Rename `section` prop to `chapter`

### Phase 7: Fix Type Mismatches

- Fix SSE validators to return proper `VideoCategory`
- Handle `isCreatorChapter` optional vs required

### Phase 8: Install Missing Dependencies

```bash
npm install @radix-ui/react-popover
```

### Phase 9: Verification

- `npm run build` passes
- No TypeScript errors

---

## Files to Modify

| File | Changes |
|------|---------|
| `packages/types/src/index.ts` | Add `Section` alias |
| `VideoDetailDesktop.tsx` | section→chapter rename |
| `VideoDetailMobile.tsx` | section→chapter rename |
| `ArticleSection.tsx` | section→chapter rename |
| `views/TravelView.tsx` | Section→SummaryChapter |
| `views/ReviewView.tsx` | Section→SummaryChapter |
| `views/FitnessView.tsx` | Section→SummaryChapter |
| `views/EducationView.tsx` | Section→SummaryChapter |
| `views/PodcastView.tsx` | Section→SummaryChapter |
| `views/DIYView.tsx` | Section→SummaryChapter |
| `views/GamingView.tsx` | Section→SummaryChapter |
| `sse-validators.ts` | Fix VideoContext type |
| `video-detail-types.ts` | Update types |
| `MemorizedBlockList.tsx` | Chapter type fix |
| `MemorizedItemDetail.tsx` | Chapter type fix |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking runtime behavior | High | Type-only changes where possible |
| Incomplete rename | Medium | Thorough search for "section" refs |

---

## Effort Estimate

- **Size:** L (Large)
- **Files Changed:** ~15
- **Lines Changed:** ~200
