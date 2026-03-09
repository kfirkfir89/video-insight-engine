# Sidebar, Header & Dropdown Redesign - Context

**Last Updated:** 2026-02-15
**Status:** All 4 phases complete. 18/18 tasks done. 17/17 Playwright tests pass.

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Branding location | Sidebar header (not main header) | Both design references place branding in sidebar |
| User avatar/dropdown | Sidebar header (right side) | User confirmed: avatar + dropdown in sidebar header |
| Section switching | Tab bar (one at a time) | User confirmed: cleaner than stacked collapsibles |
| View mode toggle | Visual only (Article active) | User confirmed: Mind Map/Chat disabled as "Coming soon" |
| DashboardPage breadcrumb | Keep as-is in content area | It handles deep folder navigation; header shows simplified context |
| Dropdown styling | Glass effect (backdrop-blur-sm) | Matches polished design references, subtle enough for both themes |

## Key Files

### NEW Files (4)
| File | Purpose |
|------|---------|
| `apps/web/src/components/sidebar/SidebarHeader.tsx` | App logo + "Video Insight" + ThemeToggle + UserDropdown |
| `apps/web/src/components/sidebar/SidebarTabs.tsx` | Summaries/Memorized tab bar with count badge + add folder |
| `apps/web/src/components/sidebar/SidebarFooter.tsx` | Video count stats bar |
| `apps/web/src/components/layout/ViewModeToggle.tsx` | Article/MindMap/Chat pill toggle (Article only functional) |

### MODIFIED Files (14)
| File | Change Scope |
|------|-------------|
| `apps/web/src/components/sidebar/Sidebar.tsx` | New component hierarchy: SidebarHeader > AddVideoInput > SidebarToolbar > SidebarTabs > Section > Footer |
| `apps/web/src/components/sidebar/SidebarSection.tsx` | **Major:** Remove Collapsible wrapper, become pure content area |
| `apps/web/src/components/sidebar/AddVideoInput.tsx` | Styling: subtler bg, Link2 icon, tighter padding |
| `apps/web/src/components/sidebar/SidebarToolbar.tsx` | Styling: remove bg, rounded-md buttons, separator |
| `apps/web/src/components/sidebar/SearchInput.tsx` | Styling: subtle bg/border |
| `apps/web/src/components/sidebar/VideoItem.tsx` | Active state: `bg-primary/8 border-l-2`, PlayCircle icon |
| `apps/web/src/components/sidebar/FolderItem.tsx` | Selected state: `border-l-2 border-l-primary`, rounded count badge |
| `apps/web/src/components/sidebar/SortDropdown.tsx` | Add "Sort by" label, w-44 |
| `apps/web/src/components/sidebar/SelectionToolbar.tsx` | `rounded-t-lg`, `shadow-xl` |
| `apps/web/src/components/layout/Header.tsx` | **Major:** Remove branding/user, add breadcrumbs + ViewModeToggle |
| `apps/web/src/components/layout/Layout.tsx` | Resize handle: transparent by default, skeleton update |
| `apps/web/src/stores/ui-store.ts` | Add: `currentVideoTitle`, `currentVideoFolderId`, `viewMode` + actions |
| `apps/web/src/pages/VideoDetailPage.tsx` | Set currentVideo in store via useEffect |
| `apps/web/src/components/ui/dropdown-menu.tsx` | Glass effect, rounded-lg, shadow-lg |

### Reference Files (read-only, patterns to follow)
| File | What to Reuse |
|------|--------------|
| `apps/web/src/lib/folder-utils.ts` | `buildBreadcrumbPath()` for header breadcrumbs |
| `apps/web/src/components/ui/breadcrumb.tsx` | Breadcrumb component for header |
| `apps/web/src/components/theme-toggle.tsx` | Move ThemeToggle to SidebarHeader |
| `apps/web/src/hooks/use-videos.ts` | `useAllVideos()` for SidebarFooter count |
| `apps/web/src/hooks/use-folders.ts` | `useFolders()` for folder names in breadcrumbs |
| `apps/web/src/lib/style-utils.ts` | `getFolderColorStyle()` for folder icons |
| `apps/web/src/hooks/use-sidebar-text-size.ts` | `useSidebarTextClasses()` for text sizing |

## Dependencies

- **Sidebar structure (Batch 1)** must complete before Header upgrade (Batch 3) since branding moves from Header to Sidebar
- **ui-store changes (1.1)** must complete first since SidebarTabs, Header, and ViewModeToggle depend on new state fields
- **Batch 2 (visual polish)** and **Batch 4 (dropdown polish)** are independent and can be done in any order

## Preserved Functionality Checklist

After all changes, these must still work:
1. Drag and drop videos between folders
2. Drag and drop folders to reorder/nest
3. Multi-selection mode (long press, Shift+Click, Ctrl+Click)
4. Bulk move and delete via SelectionToolbar
5. Search filtering across folders and videos
6. Sort dropdown (4 options)
7. Text size toggle (small/medium/large)
8. Collapse all folders
9. Add video via URL input (video and playlist modes)
10. Folder operations: create, rename, delete, subfolder
11. Video operations: context menu, move, delete, re-summarize
12. Folder color styling
13. Active video highlighting
14. Selected folder highlighting
15. Sidebar resize (200-600px)
16. Sidebar toggle (open/close)
17. Theme toggle (dark/light)
18. User authentication menu (login/logout)
19. Keyboard navigation (Escape to exit selection, Tab focus)

## Design References

Two HTML mockups provided by user:
1. **Dark theme** ("Video Insight") - `014746c47f-ae57cfe2ed2224533655.png`
2. **Light theme** ("VideoSum AI") - `596d529216-7729ed048e67a4405b3f.png`

Key visual patterns from references:
- Brand-colored left border on active/selected items
- Underline-style active tab indicator
- Subtle glass/blur effects on dropdowns and header
- Colored folder icons with count badges
- Breadcrumb navigation in header
- Pill-style view mode toggle
