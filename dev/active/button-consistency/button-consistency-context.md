# Button Consistency — Context

**Last Updated: 2026-02-19**
**Status: COMPLETED**

---

## Summary

All 5 phases completed. ~55 raw `<button>` elements across 30+ files migrated to `<Button>` component. ESLint rule added to prevent regression. Playwright visual tests pass at all viewports.

## Key Files Modified

### Core
- `apps/web/src/components/ui/button.tsx` — Added bare/icon-bare size variants
- `apps/web/eslint.config.js` — Added no-restricted-syntax rule for raw `<button>`

### Phase 2: Priority Fixes
- `apps/web/src/App.tsx` — Error fallback button → `<Button>`
- `apps/web/src/components/video-detail/ChapterNavItem.tsx` — `div role="button"` → restructured layout

### Phase 3: Content Blocks (15 files)
- TranscriptBlock, ExerciseBlock, CodeBlock, TerminalBlock, ExampleBlock
- QuizBlock, QuoteRenderer, TimestampRenderer, DefinitionBlock
- ComparisonRenderer, StepBlock, StatisticRenderer, IngredientBlock
- ToolListBlock, ArticleSection

### Phase 4: Sidebar & Navigation (11 files)
- FolderItem, CollectionPicker, CollectionDialog, ChapterList
- MobileChapterNav, OrphanedConcepts, ConceptHighlighter
- MemorizedBlockList, MemorizedGrid, VideoCard, AppHeader

### Files Intentionally Kept Raw
- `FolderTreeSelect.tsx:80` — Radix DropdownMenuItem child (eslint-disable added)
- `ConceptHighlighter.tsx:181` — Radix Popover asChild (eslint-disable added)

---

## Key Decisions

1. **`bare` vs `unstyled`:** Named `bare` because the button still gets base styles (focus ring, disabled state, transition, cursor) — it just has no height/padding constraints.

2. **`warn` not `error` for ESLint:** Using warning level allows gradual adoption. Dev-only and ui files excluded entirely.

3. **Keep 2 raw buttons:** FolderTreeSelect and ConceptHighlighter use Radix composition (`asChild`) that requires raw elements as children.

4. **ghost + bare is the default migration pattern:** Most raw buttons are auxiliary actions (play, copy, toggle) with hover backgrounds — `variant="ghost" size="bare"` matches this exactly.

5. **ChapterNavItem restructured to avoid nested buttons:** Original `<div role="button">` wrapped play/stop `<button>` elements. Converting to `<button>` would create invalid nested buttons. Fixed by making text portion a `<button>` and play/stop controls siblings.

---

## Results

| Metric | Before | After |
|--------|--------|-------|
| Raw `<button>` count | ~75 in 47 files | ~20 in 12 files |
| `role="button"` issues | 1 | 0 |
| ESLint protection | None | `no-restricted-syntax` warn rule |
| TypeScript errors | 0 | 0 |

### Remaining Raw Buttons (18 warnings from ESLint)
Files outside original migration scope — future cleanup:
- LeftSidebarIconStrip, SidebarToolbar, SidebarTabs
- FolderContextMenu, SearchInput, SortDropdown
- TextSizeToggle, VideoContextMenu, RightPanelTabs
- ChapterNavItem (inner play/stop — intentional native buttons)

---

## Audit Data (original)

| Element | Raw Count | Component Count | Status |
|---------|-----------|-----------------|--------|
| `<button>` | 75 (47 files) | 68 (35 files) | **FIXED** |
| `role="button"` | 1 | — | **FIXED** |
| `<input>` | 4 (3 files, all dev/ui) | 16 | Clean |
| `<a href>` | 2 (both asChild) | 14 Link | Clean |
