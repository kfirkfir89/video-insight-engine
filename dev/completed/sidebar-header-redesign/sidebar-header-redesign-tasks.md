# Sidebar, Header & Dropdown Redesign - Tasks

**Last Updated:** 2026-02-15
**Status:** COMPLETE

## Phase 1: Sidebar Structure (Highest Impact)

- [x] **1.1** Add `viewMode`, `currentVideoTitle`, `currentVideoFolderId` state + actions to `ui-store.ts` [S]
- [x] **1.2** Create `SidebarHeader.tsx` - logo, app name, ThemeToggle, UserDropdown [M]
- [x] **1.3** Create `SidebarTabs.tsx` - tab bar with Summaries/Memorized + count badge + add folder button [M]
- [x] **1.4** Create `SidebarFooter.tsx` - video count stats [S]
- [x] **1.5** Refactor `SidebarSection.tsx` - remove Collapsible, become pure content area [L]
- [x] **1.6** Rewire `Sidebar.tsx` layout - new component hierarchy [M]

### Phase 1 Verification
- [x] Sidebar renders with branding header, URL input, toolbar, tabs, folder tree, footer
- [x] Tab switching between Summaries and Memorized works
- [x] All folder/video items display correctly
- [x] DnD still works (drag video to folder, drag folder to reorder)
- [x] Selection mode still works (long-press, Shift+Click, Ctrl+Click)
- [x] Search and sort still work
- [x] Theme toggle works from sidebar footer
- [x] User dropdown works from sidebar footer

---

## Phase 2: Sidebar Visual Polish (Low Risk)

- [x] **2.1** Polish `AddVideoInput.tsx` - subtler bg, tighter padding, Link2 icon [S]
- [x] **2.2** Polish `SidebarToolbar.tsx` - remove bg, rounded-md buttons, separator between groups [S]
- [x] **2.3** Polish `SearchInput.tsx` - subtle bg/border [S]
- [x] **2.4** Enhance `VideoItem.tsx` - `bg-primary/8 border-l-2` active state, Film icon [S]
- [x] **2.5** Enhance `FolderItem.tsx` - `border-l-2 border-l-primary` selected state, rounded count badge [S]

### Phase 2 Verification
- [x] Active video has brand-colored left border
- [x] Selected folder has brand-colored left border
- [x] Folder count badges are rounded pills
- [x] Input areas have subtle, integrated styling
- [x] Both dark and light themes look polished

---

## Phase 3: Layout Overhaul (Replaced Header with Sidebar-Centric)

- [x] **3.1** Delete `Header.tsx` - global header removed entirely [L]
- [x] **3.2** Delete `ViewModeToggle.tsx` - view mode removed from sidebar [M]
- [x] **3.3** Redesign `Layout.tsx` - no header, floating sidebar toggle, full-height content [M]
- [x] **3.4** Clean up `VideoDetailPage.tsx` - remove currentVideo store usage [S]
- [x] **3.5** Clean up `ui-store.ts` - remove dead state (currentVideo, viewMode, sectionOpen, addVideoDialog) [M]
- [x] **3.6** `SidebarHeader.tsx` - app icon links to home, only close button (theme+user moved to footer) [S]
- [x] **3.7** `SidebarFooter.tsx` - now contains theme toggle + user profile dropdown [M]
- [x] **3.8** DevToolPanel moved below SidebarHeader in Sidebar.tsx [S]

### Phase 3 Verification
- [x] No global header bar visible
- [x] App icon links to home page
- [x] Theme toggle and user profile at bottom of sidebar (chat-app style)
- [x] Floating PanelLeft toggle appears when sidebar is closed
- [x] Video detail page fills full viewport height
- [x] Film icon on video items (not PlayCircle)
- [x] DevToolPanel renders below app branding

---

## Phase 4: Dropdown/Select Polish (Low Risk)

- [x] **4.1** Polish `dropdown-menu.tsx` - `bg-popover/95 backdrop-blur-sm`, `rounded-lg`, `shadow-lg` [S]
- [x] **4.2** Polish `SortDropdown.tsx` - add "Sort by" label, `w-44` [S]
- [x] **4.3** Polish `SelectionToolbar.tsx` - `rounded-t-lg`, `shadow-xl` [S]

### Phase 4 Verification
- [x] All dropdowns have glass effect in dark mode
- [x] Dropdown corners are more rounded
- [x] Sort dropdown has "Sort by" label
- [x] Selection toolbar has rounded top and stronger shadow

---

## Final Verification

- [x] `cd apps/web && npx tsc --noEmit` passes with no errors
- [x] `cd apps/web && npm run build` succeeds
- [x] 993/993 unit tests pass
- [x] E2E tests updated for new layout (sidebar-header-redesign.spec.ts)
- [x] Security audit: no critical/high findings
- [x] Code review: dead code removed, showNewFolderInput scoping fixed
- [x] No console errors or debug code left behind
