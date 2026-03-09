# Sidebar, Header & Dropdown Design Overhaul

**Last Updated:** 2026-02-15

## Executive Summary

Redesign the sidebar, header, and dropdown/select components to match two high-fidelity design references while preserving all existing functionality (DnD, selection mode, search, sort, folder operations). This creates a polished, professional UI combining the dark "Video Insight" and light "VideoSum AI" design languages.

## Current State

- **Sidebar:** Functional but basic. Two stacked collapsible sections (Summaries/Memorized) with folder trees, search, sort, text size, and selection mode. URL input at top.
- **Header:** Simple bar with app title "Video Insight Engine", sidebar toggle, theme toggle, and user dropdown. No breadcrumbs or view modes.
- **Dropdowns:** Standard Radix UI styling. Functional but not polished (sharp corners, no glass effect).
- **Layout:** `Layout.tsx` composes Header + Sidebar (resizable 200-600px) + main content area.

## Proposed Future State

- **Sidebar:** Branded header (logo + "Video Insight" + user avatar), URL input, search/toolbar, **tab bar** (Summaries | Memorized - one section at a time), polished folder tree with better active/selected states, video count footer.
- **Header:** Content-aware with breadcrumbs (route-sensitive), view mode pill toggle (Article/Mind Map/Chat), action buttons on video detail pages. Backdrop blur glass effect.
- **Dropdowns:** Glass effect (`backdrop-blur-sm`), rounded corners (`rounded-lg`), stronger shadows, smoother feel.

## Implementation Phases

### Phase 1: Sidebar Structure (Highest Risk)
Core layout changes - new components + rewiring sidebar hierarchy.

| # | Task | File | Type | Effort | Deps |
|---|------|------|------|--------|------|
| 1.1 | Add `viewMode`, `currentVideo*` state to ui-store | `stores/ui-store.ts` | MODIFY | S | - |
| 1.2 | Create `SidebarHeader` (branding + user + theme) | `sidebar/SidebarHeader.tsx` | NEW | M | - |
| 1.3 | Create `SidebarTabs` (tab bar for sections) | `sidebar/SidebarTabs.tsx` | NEW | M | 1.1 |
| 1.4 | Create `SidebarFooter` (video count stats) | `sidebar/SidebarFooter.tsx` | NEW | S | - |
| 1.5 | Refactor `SidebarSection` (remove Collapsible, pure content) | `sidebar/SidebarSection.tsx` | MODIFY | L | 1.3 |
| 1.6 | Rewire `Sidebar` layout (new component hierarchy) | `sidebar/Sidebar.tsx` | MODIFY | M | 1.2-1.5 |

### Phase 2: Sidebar Visual Polish (Low Risk)
Incremental class-level styling improvements.

| # | Task | File | Type | Effort | Deps |
|---|------|------|------|--------|------|
| 2.1 | Polish `AddVideoInput` styling | `sidebar/AddVideoInput.tsx` | MODIFY | S | - |
| 2.2 | Polish `SidebarToolbar` (remove bg, separators) | `sidebar/SidebarToolbar.tsx` | MODIFY | S | - |
| 2.3 | Polish `SearchInput` (subtle bg/border) | `sidebar/SearchInput.tsx` | MODIFY | S | - |
| 2.4 | Enhance `VideoItem` active state + PlayCircle icon | `sidebar/VideoItem.tsx` | MODIFY | S | - |
| 2.5 | Enhance `FolderItem` selected state + count badge | `sidebar/FolderItem.tsx` | MODIFY | S | - |

### Phase 3: Header Upgrade (Medium Risk)
Content-aware header with breadcrumbs and view toggle.

| # | Task | File | Type | Effort | Deps |
|---|------|------|------|--------|------|
| 3.1 | Redesign `Header` (breadcrumbs, remove branding/user) | `layout/Header.tsx` | MODIFY | L | 1.1, 1.2 |
| 3.2 | Create `ViewModeToggle` pill component | `layout/ViewModeToggle.tsx` | NEW | M | 1.1 |
| 3.3 | Polish `Layout` resize handle + skeleton | `layout/Layout.tsx` | MODIFY | S | 1.2 |
| 3.4 | Set `currentVideo` in store from VideoDetailPage | `pages/VideoDetailPage.tsx` | MODIFY | S | 1.1 |

### Phase 4: Dropdown/Select Polish (Low Risk)
Global dropdown styling improvements.

| # | Task | File | Type | Effort | Deps |
|---|------|------|------|--------|------|
| 4.1 | Glass effect + rounded corners on `dropdown-menu.tsx` | `ui/dropdown-menu.tsx` | MODIFY | S | - |
| 4.2 | Add label to `SortDropdown` | `sidebar/SortDropdown.tsx` | MODIFY | S | - |
| 4.3 | Polish `SelectionToolbar` rounding + shadow | `sidebar/SelectionToolbar.tsx` | MODIFY | S | - |

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| SidebarSection Collapsible removal breaks DnD | High | Preserve root drop target, scroll area, and selection handlers exactly. Test DnD immediately after. |
| Tab switching breaks DndProvider context | Medium | DndProvider wraps both sections; only visibility changes. Verify sensors work on tab switch. |
| Header breadcrumbs cause re-renders | Low | Use selective Zustand subscriptions. Folder data already cached by React Query. |
| Dropdown glass effect blurs incorrectly | Low | Use `backdrop-blur-sm` (small) and `bg-popover/95` (near-opaque). Test in both themes. |

## Success Metrics

1. Visual match with design references in both dark and light themes
2. Zero functionality regressions (all 19 features in verification checklist pass)
3. TypeScript build succeeds with no errors
4. No new Lighthouse performance regressions

## Required Resources

- **Tech:** React, TypeScript, Tailwind v4, shadcn/ui, lucide-react, Zustand, Radix UI
- **Existing utilities to reuse:**
  - `buildBreadcrumbPath` from `@/lib/folder-utils`
  - `Breadcrumb` from `@/components/ui/breadcrumb`
  - `ThemeToggle` from `@/components/theme-toggle`
  - `useUIStore` from `@/stores/ui-store`
  - `useAllVideos` from `@/hooks/use-videos`
  - `getFolderColorStyle` from `@/lib/style-utils`
