# Performance Optimization Plan

**Last Updated: 2026-02-26**

---

## Executive Summary

The web app has severe React rendering performance issues visible with react-scan:
- **Sidebar DnD**: Destroys FPS — dragging triggers 60+ re-renders/sec via dead state + unstable array props bypass memoization
- **Right panel**: Re-renders non-stop on every scroll (not memoized, unstable props)
- **Theme change**: Slow — cascading re-renders through the whole tree
- **Lighthouse score**: 31 (partly misleading — auth redirect, dev server — but real CSS/bundle issues too)

**Strategy**: Install React Compiler first (auto-memoization), then test with react-scan to see what's still broken, then fix only structural issues the compiler can't solve, then CSS/Lighthouse quick wins.

---

## Current State Analysis

### Component Tree (Sidebar — Primary Bottleneck)

```
Layout.tsx
└── Sidebar.tsx (memo'd, lazy-loaded)
    ├── SidebarHeader.tsx (memo'd)
    ├── SidebarTabs.tsx (NOT memo'd) ← re-renders on any video/folder query
    ├── SidebarToolbar.tsx (NOT memo'd) ← 11 Zustand selectors
    └── DndProvider.tsx (NOT memo'd) ← re-renders 60+/sec during drag
        ├── SidebarSection.tsx (NOT memo'd) ← BOTTLENECK: full tree recompute
        │   ├── FolderTree.tsx (memo'd)
        │   │   └── FolderItem.tsx (memo'd, recursive) ← 14 Zustand selectors
        │   │       ├── CreateSubfolderInput.tsx
        │   │       ├── FolderRenameInput.tsx
        │   │       ├── FolderContextMenu.tsx
        │   │       ├── VideoItem.tsx (memo'd)
        │   │       └── FolderItem.tsx (recursive children)
        │   └── UnassignedVideosList.tsx (NOT memo'd)
        │       └── VideoItem.tsx (memo'd)
        └── SelectionToolbar.tsx (NOT memo'd)
```

### Confirmed Issues (from code audit)

| Issue | Severity | File | Root Cause |
|-------|----------|------|------------|
| Dead DndStateContext | HIGH | DndProvider.tsx | `overFolderId` state triggers 60+/sec re-renders during drag, context never consumed |
| Unstable `\|\| []` arrays | HIGH | SidebarSection.tsx:147 | New array ref every render, breaks child memo() |
| itemOrder useEffect | MEDIUM | SidebarSection.tsx:61-88 | O(n) recomputation on every expandedFolderIds change, setState triggers subscribers |
| FolderItem array props | MEDIUM | FolderItem.tsx | `videos`, `allFolders` arrays unstable from parent |
| transition-all CSS | LOW | CreateSubfolderInput.tsx:90 | Animates all properties instead of specific ones |
| asyncCssPlugin FOUC | LOW | vite.config.ts:12-26 | CSS made non-blocking causes flash of unstyled content |
| Hero lazy loading | LOW | VideoHero.tsx:89 | LCP image uses `loading="lazy"` instead of `fetchPriority="high"` |
| Infinite CSS animations | LOW | index.css | `breathe` and `pulse-ring` run infinite |

---

## Implementation Phases

### Phase 1: React Compiler Installation (Effort: M)

Auto-memoization for ~156 patterns. Eliminates most manual useMemo/useCallback needs.

**Readiness**: 8/10 — React 19.2.0, all functional components, no class components, no babel conflicts.

**Steps**:
1. Install `babel-plugin-react-compiler` + `eslint-plugin-react-compiler`
2. Update `vite.config.ts` — add babel plugin to react()
3. Update `eslint.config.js` — add compiler lint rules
4. Verify build succeeds, tests pass
5. Baseline measurement with react-scan

**What compiler auto-fixes**: Inline objects, unstable callbacks, missing useMemo/useCallback. Most FolderItem/VideoItem handler instability should be resolved.

**What compiler CANNOT fix**: Dead DnD context (Phase 2), unstable `|| []` array fallbacks (Phase 2), content-visibility/CSS (Phase 4).

---

### Phase 2: Sidebar / Folder Explorer Fix (Effort: L)

Fix structural issues the compiler can't solve.

#### 2.1 Remove Dead DndStateContext + Stabilize DndProvider

**Files**: `DndProvider.tsx`, `dnd-context.ts` (DELETE)

**Root cause**: `handleDragOver` calls `setOverFolderId()` on every mouse move. Re-renders DndProvider, recreating all handler functions. `DndStateContext.Provider` wraps the sidebar but `useOverFolderId()` is **never consumed** (dead code).

**Fixes**:
1. Remove `overFolderId` state entirely
2. Remove `handleDragOver` setState call
3. Remove `DndStateContext.Provider` wrapper
4. Delete `dnd-context.ts`
5. Wrap remaining handlers in `useCallback`
6. Move `DragOverlay` into `createPortal(..., document.body)`

#### 2.2 Fix Unstable Array Props in SidebarSection

**File**: `SidebarSection.tsx`

**Fix**: Memoize fallback arrays:
```tsx
const folders = useMemo(() => foldersData?.folders ?? [], [foldersData?.folders]);
const videos = useMemo(() => videosData?.videos ?? [], [videosData?.videos]);
```

#### 2.3 Test with react-scan

After 2.1 + 2.2, test with react-scan. Only add explicit `memo()` where issues persist post-compiler.

**Components to watch**: SidebarSection, SidebarTabs, SidebarToolbar, UnassignedVideosList, SelectionToolbar, RightPanelTabs, StickyChapterNav, ChapterNavItem.

#### 2.4 Fix itemOrder useEffect

**File**: `SidebarSection.tsx:61-88`

Convert `useEffect + setState` to `useMemo`. Only compute when `selectionMode === true`.

#### 2.5 Fix FolderItem Array Props

**File**: `FolderItem.tsx`

Memoize filtered videos: `useMemo(() => videos.filter(v => v.folderId === folder.id), [videos, folder.id])`

#### 2.6 Fix CSS transition-all

**File**: `CreateSubfolderInput.tsx`

Replace `transition-all` with `transition-[grid-template-rows,opacity]`.

---

### Phase 3: Right Panel + Scroll Cascade (Effort: S — Conditional)

Only if react-scan shows issues after Phase 1-2.

- 3.1 Verify scroll doesn't cascade from ScrollContainer
- 3.2 Verify callback stability in VideoDetailLayout
- 3.3 Add manual memo only where still needed

---

### Phase 4: CSS & Lighthouse Quick Wins (Effort: S)

- 4.1 Remove asyncCssPlugin (causes FOUC, CSS is only 17KB brotli)
- 4.2 Fix Hero Thumbnail LCP (`loading="lazy"` → `fetchPriority="high"`)
- 4.3 Stop Infinite CSS Animations (`breathe` infinite→2, `pulse-ring` infinite→3)
- 4.4 Trim Imperceptible Dark Mode Drop-Shadows (opacity <= 0.15)
- 4.5 Add content-visibility for Off-Screen Chapters

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| React Compiler breaks existing code | Low | High | Run full test suite, incremental rollout |
| Removing DnD context breaks drop targets | Very Low | Medium | `useOverFolderId` confirmed unused by grep |
| Memoized arrays cause stale data | Low | Medium | Dependencies track source data correctly |
| content-visibility causes layout shifts | Medium | Low | Use `contain-intrinsic-size` to reserve space |
| CSS changes affect visual design | Low | Low | Visual regression testing with Playwright |

---

## Success Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|---------------|
| DnD FPS | ~10-15 (60+ re-renders/sec) | >50 FPS | react-scan during drag |
| Sidebar re-renders on scroll | Every frame | 0 | react-scan during scroll |
| Theme toggle cascade | Full tree | Only themed components | react-scan during toggle |
| Lighthouse Performance | 31 | 80+ | Lighthouse on prod build |
| Build succeeds | Yes | Yes | `pnpm build` |
| Tests pass | Yes | Yes | `pnpm test` |

---

## Dependencies

- React 19.2.0 (already installed)
- babel-plugin-react-compiler (to install)
- eslint-plugin-react-compiler (to install)
- react-scan (dev tool, browser extension)
