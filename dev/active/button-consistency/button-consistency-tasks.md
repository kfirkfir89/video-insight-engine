# Button Consistency — Tasks

**Last Updated: 2026-02-19**

---

## Phase 1: Foundation [S] ✅

- [x] Add `bare` size variant to Button CVA (`"h-auto p-0 gap-1 rounded-sm"`)
- [x] Add `icon-bare` size variant to Button CVA (`"h-auto p-0.5 rounded-sm"`)
- [x] Verify TypeScript compiles (`npx tsc --noEmit`)

## Phase 2: Priority 1 Fixes [S] ✅

- [x] `App.tsx:63` — Replace raw `<button>` with `<Button>`, add import
- [x] `ChapterNavItem.tsx:61-72` — Replace `<div role="button">` with restructured layout (text portion as `<button>`, play/stop as siblings to avoid nesting)

## Phase 3: Content Block Migration [L] ✅

- [x] `TranscriptBlock.tsx` — 2 buttons (seek, expand) → ghost/bare
- [x] `ExerciseBlock.tsx` — 1 button (watch demo) → ghost/bare
- [x] `CodeBlock.tsx` — 1 button (copy) → ghost/bare
- [x] `TerminalBlock.tsx` — 1 button (copy) → ghost/bare
- [x] `ExampleBlock.tsx` — 2 buttons (copy) → ghost/bare
- [x] `QuizBlock.tsx` — 1 button (answer option) → ghost/bare + whitespace-normal
- [x] `QuoteRenderer.tsx` — 2 buttons (seek, copy) → ghost/bare
- [x] `TimestampRenderer.tsx` — 2 buttons (play, stop) → ghost/bare
- [x] `DefinitionBlock.tsx` — 2 buttons (show more/less) → ghost/bare
- [x] `ComparisonRenderer.tsx` — 1 button (toggle view) → ghost/icon-bare
- [x] `StepBlock.tsx` — 1 button (toggle step) → ghost/icon-bare
- [x] `StatisticRenderer.tsx` — 1 button (copy stat) → ghost/bare
- [x] `IngredientBlock.tsx` — 1 button (toggle check) → ghost/icon-bare
- [x] `ToolListBlock.tsx` — 1 button (toggle check) → ghost/icon-bare
- [x] `ArticleSection.tsx` — 5 buttons (play, stop, go deeper) → ghost/icon-bare

## Phase 4: Sidebar & Navigation Migration [M] ✅

- [x] `FolderItem.tsx` — 2 buttons (expand, add subfolder) → ghost/icon-bare
- [x] `CollectionPicker.tsx` — 2 buttons (select, create) → ghost/bare
- [x] `CollectionDialog.tsx` — 1 button (color select) → ghost/icon-bare
- [x] `ChapterList.tsx` — 1 button (seek to chapter) → ghost/bare + whitespace-normal
- [x] `MobileChapterNav.tsx` — 1 button (nav pill) → ghost/bare
- [x] `OrphanedConcepts.tsx` — 2 buttons (expand, toggle) → ghost/bare
- [x] `ConceptHighlighter.tsx` — 1 button (tell me more) → ghost/bare; SKIPPED line 179 (Radix asChild)
- [x] `MemorizedBlockList.tsx` — 2 buttons (play, open) → ghost/bare + rounded-none
- [x] `MemorizedGrid.tsx` — 1 button (open card) → ghost/bare + flex-col whitespace-normal
- [x] `VideoCard.tsx` — 1 button (play overlay) → ghost/icon-bare + rounded-none
- [x] `AppHeader.tsx` — 1 button (profile trigger) → ghost/icon-bare

## Phase 5: Lint Rule [S] ✅

- [x] Add `no-restricted-syntax` rule to `eslint.config.js` targeting `<button>` JSX
- [x] Add override: `off` for `components/ui/**`
- [x] Add override: `off` for `components/dev/**` and `pages/dev/**`
- [x] Add `// eslint-disable-next-line` to FolderTreeSelect.tsx:80 and ConceptHighlighter.tsx:181
- [x] Run `npx eslint src/` and verify warnings are correct

## Verification ✅

- [x] Visual walkthrough: dashboard, video detail — all content blocks render correctly
- [x] Playwright tests: desktop (1280px), tablet (768px), mobile (375px)
- [x] No overflow, no layout regressions at any viewport size
- [x] Accessibility snapshot confirms proper button roles and labels
- [x] `npx tsc --noEmit` passes (zero errors)
- [x] `npx eslint src/` — 18 warnings from files outside original scope (future cleanup)
- [x] Raw button count: 20 across 12 files (down from ~75 across 47 files)
- [x] 2 intentional Radix asChild exceptions with eslint-disable comments

### Playwright Test Results

| Viewport | Page | Result |
|----------|------|--------|
| Desktop 1280x800 | Dashboard | Pass — sidebar buttons, video cards, folder tree |
| Desktop 1280x800 | Video Detail | Pass — content blocks, chapter list, concept highlights, right panel |
| Tablet 768x1024 | Dashboard | Pass — 2-col grid, collapsed sidebar, header buttons |
| Tablet 768x1024 | Video Detail | Pass — comparison blocks, quotes, terminal blocks |
| Mobile 375x812 | Dashboard | Pass — sidebar toolbar, folder items, no overflow |
| Mobile 375x812 | Video Detail | Pass — full-width content, no horizontal scroll |

### Pre-existing Issue Found (not caused by migration)
- At 375px mobile width, the sidebar toggle button in the header is obscured by the URL input's absolutely-positioned elements. This is a pre-existing layout issue unrelated to button migration.
