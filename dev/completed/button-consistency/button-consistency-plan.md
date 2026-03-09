# Button Consistency — Eliminate Raw `<button>` Usage

**Last Updated: 2026-02-19**

---

## Executive Summary

An audit found **75 raw `<button>` tags vs 68 `<Button>` component usages** across the frontend. The root cause: the Button component's smallest size (`h-8`) is too large for ultra-compact controls, so developers bypass it with raw HTML. There's also 1 accessibility issue (`role="button"` on a div) and no lint rule to prevent regression.

**Goal:** Reduce raw `<button>` to ~2 (Radix asChild exceptions only), add Button size variants that eliminate the bypass reason, and add an ESLint rule to prevent future drift.

---

## Current State

| Metric | Value |
|--------|-------|
| Raw `<button>` tags | 75 (47 files) |
| `<Button>` component usages | 68 (35 files) |
| Raw/Component ratio | 52% / 48% |
| `role="button"` on div | 1 (a11y issue) |
| ESLint rule for enforcement | None |
| Button CVA sizes | 6 (default, sm, lg, icon, icon-sm, icon-lg) |

### Why developers bypass `<Button>`

1. **Minimum height constraint** — Smallest size is `h-8` (32px). Many UI patterns need `h-7` (28px), `h-auto`, or zero padding.
2. **Unwanted padding** — `sm` size adds `px-3`, too much for inline text-like actions.
3. **Content blocks** — ~20 block components want "text-like" clickable elements, not button-shaped UI.

---

## Proposed Future State

| Metric | Target |
|--------|--------|
| Raw `<button>` tags (production) | ~2 (Radix asChild only) |
| `<Button>` component usages | ~140+ |
| ESLint enforcement | `warn` on raw `<button>` |
| Button CVA sizes | 8 (+`bare`, +`icon-bare`) |

---

## Implementation Phases

### Phase 1: Foundation (Step 1) — Effort: S

Add `bare` and `icon-bare` size variants to Button CVA. This unblocks all subsequent migrations.

**File:** `apps/web/src/components/ui/button.tsx`

New sizes:
- `bare`: `"h-auto p-0 gap-1 rounded-sm"` — text-like button, no min height
- `icon-bare`: `"h-auto p-0.5 rounded-sm"` — icon-only, minimal padding

### Phase 2: Priority Fixes (Steps 2-3) — Effort: S

**2a. App.tsx error button** (line 63)
- Replace raw `<button>` with `<Button>` component
- Add import statement
- User-facing error recovery UI

**2b. ChapterNavItem role="button" div** (line 61-72)
- Replace `<div role="button">` with semantic `<button>`
- Remove manual `onKeyDown` and `tabIndex` (native button handles these)
- Accessibility fix

### Phase 3: Content Block Migration (Step 4a-b) — Effort: L

Migrate ~27 raw buttons across 15 files in `video-detail/blocks/` and `ArticleSection.tsx`.

**Pattern for each file:**
1. Add `import { Button } from "@/components/ui/button"`
2. Replace `<button>` with `<Button variant="ghost" size="bare">` (text+icon) or `<Button variant="ghost" size="icon-bare">` (icon-only)
3. Remove redundant focus ring classes (`focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50`)
4. Keep existing `className` for custom styling (colors, opacity, positioning)

**Files (14 block files + ArticleSection):**
| File | Count | Size Variant |
|------|-------|-------------|
| TranscriptBlock.tsx | 2 | bare |
| ExerciseBlock.tsx | 1 | bare |
| CodeBlock.tsx | 1 | bare |
| TerminalBlock.tsx | 1 | bare |
| ExampleBlock.tsx | 2 | bare |
| QuizBlock.tsx | 1 | bare |
| QuoteRenderer.tsx | 2 | bare |
| TimestampRenderer.tsx | 2 | bare |
| DefinitionBlock.tsx | 2 | bare |
| ComparisonRenderer.tsx | 1 | bare |
| StepBlock.tsx | 1 | bare |
| StatisticRenderer.tsx | 1 | bare |
| IngredientBlock.tsx | 1 | bare |
| ToolListBlock.tsx | 1 | bare |
| ArticleSection.tsx | 5 | icon-bare |

### Phase 4: Sidebar & Navigation Migration (Step 4c-d) — Effort: M

Migrate ~17 raw buttons across 11 files.

| File | Count | Size Variant |
|------|-------|-------------|
| FolderItem.tsx | 2 | icon-bare |
| CollectionPicker.tsx | 2 | bare |
| CollectionDialog.tsx | 1 | icon-bare |
| ChapterList.tsx | 1 | bare |
| MobileChapterNav.tsx | 1 | bare |
| OrphanedConcepts.tsx | 2 | bare |
| ConceptHighlighter.tsx | 1 (migrate) + 1 (keep raw) | bare |
| MemorizedBlockList.tsx | 2 | bare |
| MemorizedGrid.tsx | 1 | bare |
| VideoCard.tsx | 1 | icon-bare |
| AppHeader.tsx | 1 | icon-bare |

**Files to SKIP (keep raw):**
- `FolderTreeSelect.tsx:80` — inside Radix DropdownMenuItem
- `ConceptHighlighter.tsx:179` — Radix Popover asChild composition

### Phase 5: Lint Rule (Step 5) — Effort: S

**File:** `apps/web/eslint.config.js`

Add `no-restricted-syntax` rule to flag raw `<button>` usage:
- `warn` level (not error) for gradual adoption
- Override `off` for `components/ui/**` (component definitions)
- Override `off` for `components/dev/**` and `pages/dev/**` (dev-only)
- Remaining Radix exceptions use `// eslint-disable-next-line` with comment

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Visual regression from Button base styles | Medium | Medium | The `bare` variant strips all sizing, so base styles (focus ring, disabled, transition) add value without visual change. Test each block visually. |
| Button `whitespace-nowrap` breaking multi-line content | Low | Low | The `bare` variant can override with `className="whitespace-normal"` where needed |
| SVG sizing from base `[&_svg]:size-4` conflicting | Low | Medium | Existing buttons already have explicit icon sizes (`h-3 w-3`, `h-4 w-4`), which will override the base |
| ESLint rule too noisy | Low | Low | Using `warn` not `error`; dev/ excluded; can downgrade to off if needed |

---

## Success Metrics

1. Raw `<button>` count outside ui/ and dev/ drops to ~2
2. Zero `role="button"` on non-button elements
3. ESLint rule catches new raw button introductions
4. No visual regressions in content blocks, sidebar, or navigation
5. TypeScript compiles with zero errors

---

## Verification Plan

1. **Visual regression:** Dev server walkthrough of dashboard, video detail, collections, memorized items
2. **Focus ring check:** Tab through all migrated buttons
3. **TypeScript:** `cd apps/web && npx tsc --noEmit`
4. **ESLint:** `cd apps/web && npx eslint src/`
5. **Button count:** `grep -r '<button' apps/web/src --include='*.tsx' | grep -v 'components/ui/' | grep -v 'components/dev/' | grep -v 'pages/dev/' | wc -l` should be ~2
