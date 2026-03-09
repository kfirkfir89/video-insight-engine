# Right Sidebar: Global Context → Local Tabs

Last Updated: 2026-02-18

## Executive Summary

Refactor the right sidebar from a global context-based architecture to a local, page-scoped component with tab-based UI. The right sidebar (minimap, chapters, chat) is only used on the video detail page but currently wraps the entire app via `RightSidebarProvider` in `App.tsx` and renders in `Layout.tsx`. This change makes it local to `VideoDetailDesktop`, removes 3 files, simplifies Layout, and replaces the "cubes" UI with a familiar tab pattern matching the main sidebar.

## Current State

### Architecture
```
App.tsx → RightSidebarProvider (wraps everything)
              ↓
         Layout.tsx reads context → renders <aside> with RightPanelStack
              ↑
         VideoDetailLayout pushes content via useRightSidebar() hook
```

### Problems
1. **Over-engineered**: React Context wraps entire app for a feature used on one page
2. **Indirect content flow**: Content built in VideoDetailLayout → pushed to Context → read by Layout → rendered in aside
3. **Cubes UI**: Tiny 11x11px colored squares feel disconnected from the tab-based main sidebar
4. **Layout pollution**: Layout.tsx has right sidebar logic (width, visibility, aside rendering) that's only relevant to one page

### Key Files (Current)
| File | Role |
|------|------|
| `apps/web/src/App.tsx` | Wraps app with `RightSidebarProvider` |
| `apps/web/src/components/layout/RightSidebarContext.tsx` | React Context definition |
| `apps/web/src/hooks/use-right-sidebar.ts` | Hook to push content to context |
| `apps/web/src/components/layout/Layout.tsx` | Reads context, renders `<aside>` |
| `apps/web/src/components/video-detail/RightPanelStack.tsx` | Cube buttons + panel content |
| `apps/web/src/components/video-detail/VideoDetailLayout.tsx` | Orchestrator, builds & pushes content |
| `apps/web/src/components/video-detail/VideoDetailDesktop.tsx` | Desktop rendering |
| `apps/web/src/stores/ui-store.ts` | Zustand: `activeRightPanel` state (persisted) |

## Proposed Future State

### Architecture
```
App.tsx → Layout.tsx (no right sidebar knowledge)
              ↓
         VideoDetailDesktop renders RightPanelTabs inline (flex sibling)
         - Large desktop (≥1280px): sticky inline panel
         - Medium desktop (768-1280px): floating panel bottom-right
         - Mobile (<768px): no panel (existing full-screen chat)
```

### Benefits
- No global context/provider for a page-local feature
- Layout.tsx is simpler (left sidebar + content only)
- Direct rendering: Desktop component owns its right panel
- Tab UI matches main sidebar pattern (consistent UX)
- 3 files deleted, net code reduction

---

## Implementation Phases

### Phase 1: Create New Tab Component
Create `RightPanelTabs.tsx` as drop-in replacement for `RightPanelStack.tsx`.

### Phase 2: Wire Into VideoDetailDesktop
Add the right panel as an inline flex sibling in the desktop layout, plus floating variant for medium screens.

### Phase 3: Strip Global Infrastructure
Remove context provider from App.tsx, right sidebar code from Layout.tsx, and simplify VideoDetailLayout.

### Phase 4: Delete Old Files & Update Tests
Remove dead files and update E2E tests for new test IDs and behavior.

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Sticky panel clipped by ScrollContainer | Medium | Test `overflow` interaction; may need to move panel outside scroll area |
| Content too narrow with 360px panel on 1280px screens | Low | Reduce horizontal padding when panel is open |
| Click-outside handler scope change | Low | Set containerRef on RightPanelTabs wrapper, same logic |
| Zustand state already persisted with panel open | None | Desired behavior, no change needed |
| E2E test selectors break | Medium | Update all test IDs in same PR |

## Success Metrics

- `RightSidebarProvider` removed from App.tsx
- Layout.tsx has zero right sidebar code
- Right panel renders only on `/video/:id` route
- Tab appearance matches SidebarTabs pattern
- All 3 responsive breakpoints work (large desktop, medium, mobile)
- `pnpm build` passes with no type errors
- E2E tests pass with updated selectors
