# Right Sidebar Local Tabs — Tasks

Last Updated: 2026-02-18

## Phase 1: Create New Tab Component [M]

- [x] **1.1** Create `RightPanelTabs.tsx` with PANELS config (minimap, chapters, chat)
- [x] **1.2** Implement collapsed state: vertical icon strip (40x40 buttons, 48px width)
- [x] **1.3** Implement expanded state: horizontal tab bar + scrollable content area
- [x] **1.4** Tab styling matches SidebarTabs: `text-primary bg-primary/10` active, `text-muted-foreground` inactive
- [x] **1.5** Support `variant` prop: "inline" (desktop sidebar) vs "floating" (medium screen overlay)
- [x] **1.6** Retain Escape key handler (close panel, skip if inside dialog)
- [x] **1.7** Retain click-outside handler (close panel, skip if inside portal)
- [x] **1.8** Wire to Zustand: `activeRightPanel` / `toggleRightPanel` from ui-store
- [x] **1.9** Test IDs: `right-panel-tabs`, `tab-minimap`, `tab-chapters`, `tab-chat`, `expanded-panel`

## Phase 2: Wire Into VideoDetailDesktop [M]

- [x] **2.1** Add flex row wrapper: existing content (`flex-1 min-w-0`) + right panel
- [x] **2.2** Large desktop (≥1280px): render inline `RightPanelTabs` as sticky sidebar
  - Width transition: 48px collapsed → 360px expanded (300ms ease-out)
  - Height: `h-[calc(100vh-80px)]` sticky
- [x] **2.3** Medium desktop (<1280px): render floating `RightPanelTabs` variant
  - `fixed bottom-4 right-3 z-50`
  - Width: 48px → 320px, Height: auto → 70vh
- [x] **2.4** Import and render `StickyChapterNav` + `VideoChatPanel` as panel content
- [x] **2.5** Adjust horizontal padding on large desktop when panel is expanded

## Phase 3: Strip Global Infrastructure [M]

- [x] **3.1** `App.tsx`: Remove `RightSidebarProvider` import and wrapper
- [x] **3.2** `Layout.tsx`: Remove imports (`useRightSidebarContext`, `useIsLargeDesktop`)
- [x] **3.3** `Layout.tsx`: Remove constants (`RIGHT_PANEL_WIDTH`, `CUBE_STRIP_WIDTH`)
- [x] **3.4** `Layout.tsx`: Remove state (`activeRightPanel`, `sidebarContent`, `sidebarEnabled`, derived booleans)
- [x] **3.5** `Layout.tsx`: Remove the `<aside>` right panel block
- [x] **3.6** `VideoDetailLayout.tsx`: Remove imports (`useRightSidebar`, `useIsLargeDesktop`, `RightPanelStack`, `StickyChapterNav`, `VideoChatPanel`)
- [x] **3.7** `VideoDetailLayout.tsx`: Remove `isLargeDesktop`, `activeRightPanel`, `rightSidebarContent` useMemo, `useRightSidebar()` call
- [x] **3.8** `VideoDetailLayout.tsx`: Remove `showFloatingCubes` and floating cubes div

## Phase 4: Delete Old Files & Update Tests [S]

- [x] **4.1** Delete `apps/web/src/components/layout/RightSidebarContext.tsx`
- [x] **4.2** Delete `apps/web/src/hooks/use-right-sidebar.ts`
- [x] **4.3** Delete `apps/web/src/components/video-detail/RightPanelStack.tsx`
- [x] **4.4** Rename `right-panel-cubes.spec.ts` → `right-panel-tabs.spec.ts`
- [x] **4.5** Update E2E test IDs (cube → tab), widths (64→48), timing (1200→300)
- [x] **4.6** Remove any remaining imports referencing deleted files

## Phase 5: Verification [S]

- [x] **5.1** `pnpm build` passes (no type errors)
- [x] **5.2** Visual: `/video/:id` shows tab strip on right, expands on click
- [x] **5.3** Responsive: below 1280px shows floating panel with tabs
- [x] **5.4** Mobile: below 768px has no right panel, full-screen chat works
- [x] **5.5** State persistence: toggle panel, reload — same panel stays open
- [x] **5.6** Dashboard `/` has no right sidebar visible
- [x] **5.7** E2E tests pass (23 right-panel + 12 layout audit + 102 full suite)
