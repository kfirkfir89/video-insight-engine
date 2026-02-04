# Frontend TypeScript Error Fixes - Task Checklist

**Last Updated:** 2026-02-04
**Status:** COMPLETE

---

## Pre-Flight Checks

- [x] Read plan file
- [x] Identify root causes
- [x] Verify all affected files

---

## Phase 1: Add Chapter Type Alias

- [x] Edit `packages/types/src/index.ts`
- [x] Add `Chapter` type alias after `StreamingChapter` interface
- [x] Add `Section` type alias (deprecated, for backward compat)
- [x] Fix duplicate `category` field in `VideoContext`
- [x] Fix `MemorizedItem.chapters` to use `SummaryChapter[]`

---

## Phase 2: Fix VideoDetailLayout.tsx

- [x] Replace `sectionIdsString` with `chapterIdsString`
- [x] Replace `sectionIds` with `chapterIds`
- [x] Replace `matchConceptsToSections` with `matchConceptsToChapters`
- [x] Replace `summary.sections` with `summary.chapters`
- [x] Update type imports

---

## Phase 3: Fix VideoDetailDesktop.tsx & VideoDetailMobile.tsx

- [x] Replace all `summary.sections` with `summary.chapters`
- [x] Fix variable names (`section` → `chapter`)
- [x] Fix callback names (`scrollToSection` → `scrollToChapter`, etc.)
- [x] Update component props for StickyChapterNav/MobileChapterNav

---

## Phase 4: Fix View Components

- [x] TravelView.tsx - Section → SummaryChapter
- [x] ReviewView.tsx - Section → SummaryChapter
- [x] FitnessView.tsx - Section → SummaryChapter
- [x] EducationView.tsx - Section → SummaryChapter
- [x] PodcastView.tsx - Section → SummaryChapter
- [x] DIYView.tsx - Section → SummaryChapter
- [x] GamingView.tsx - Section → SummaryChapter

---

## Phase 5: Fix ArticleSection.tsx

- [x] Import `SummaryChapter` instead of `Section`
- [x] Fix `section` variable to `chapter`
- [x] Update useMemo dependencies

---

## Phase 6: Fix Type Definitions

- [x] Fix `video-detail-types.ts` - update effectiveChapters type
- [x] Fix `ChapterList.tsx` - update chapters prop type
- [x] Fix `sse-validators.ts` - VideoCategory enum for category field

---

## Phase 7: Install Missing Dependencies

- [x] Install `@radix-ui/react-popover`

---

## Phase 8: Verification

- [x] Run `npm run build` in packages/types - passes
- [x] Run `npm run build` in apps/web - passes
- [x] No TypeScript errors

---

## Summary of Changes

### packages/types/src/index.ts
- Added `Chapter` type alias (`= StreamingChapter`)
- Added `Section` type alias (`= SummaryChapter`, deprecated)
- Fixed `VideoContext.category` duplicate field (merged to single `VideoCategory`)
- Changed `MemorizedItem.chapters` from `Chapter[]` to `SummaryChapter[]`

### apps/web files fixed
- VideoDetailLayout.tsx
- VideoDetailDesktop.tsx
- VideoDetailMobile.tsx
- ArticleSection.tsx
- video-detail-types.ts
- ChapterList.tsx
- sse-validators.ts
- All views/ files (TravelView, ReviewView, FitnessView, EducationView, PodcastView, DIYView, GamingView)

### Dependencies
- Added `@radix-ui/react-popover`

---

## Task Complete

All TypeScript errors resolved. Build passes successfully.
