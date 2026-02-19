# VideoHero Merge — Tasks

Last Updated: 2026-02-19

---

## Phase 1: Create VideoHero Component

- [x] **1.1** Create `VideoHero.tsx` with forwardRef, unified layout, streaming states
  - [x] Props interface with slot pattern (backButton, primaryAction, actions)
  - [x] Thumbnail ambient fade (absolute positioned, gradient from-background)
  - [x] Nav row (back left, stop/primary/overflow right)
  - [x] Title with YouTube link + ExternalLink hover icon
  - [x] Inline metadata breadcrumb (channel, duration, chapters, concepts, status)
  - [x] VideoTags integration
  - [x] Fade divider separator
  - [x] TL;DR section with skeleton + streaming cursor
  - [x] Key takeaways with CheckCircle icons
  - [x] Bottom fade divider
  - [x] `id="video-header"` preserved on header element

## Phase 2: Integrate Into Layouts

- [x] **2.1** Update `VideoDetailDesktop.tsx`
  - [x] Replace imports (VideoHeaderSection + TldrHero → VideoHero)
  - [x] Remove bg-primary/[0.12] header wrapper
  - [x] Remove bg-primary/[0.04] TLDR wrapper + gradient
  - [x] Create primaryAction (Quick Read button)
  - [x] Create actions (DropdownMenu with Copy/Export/Chat)
  - [x] Render single `<VideoHero ref={headerRef} />`
  - [x] Verify headerRef still works for sticky panel

- [x] **2.2** Update `VideoDetailMobile.tsx`
  - [x] Replace imports (VideoHeaderSection + TldrHero → VideoHero)
  - [x] Remove separate back button / actions row (lines 53-98)
  - [x] Create backButton prop (Link with ArrowLeft)
  - [x] Create actions prop (icon buttons for Copy/Download/Chat)
  - [x] Render single `<VideoHero />`
  - [x] Verify chat drawer still works

## Phase 3: Loading State & Cleanup

- [x] **3.1** Update `VideoDetailLayout.tsx`
  - [x] Replace VideoHeaderSection import → VideoHero
  - [x] Use VideoHero in loading state (summary={null})

- [x] **3.2** Delete old components
  - [x] Delete `VideoHeaderSection.tsx`
  - [x] Delete `TldrHero.tsx`
  - [x] Verify no remaining imports of deleted files

## Phase 4: Verification

- [x] **4.1** Build check — `vite build` succeeds
- [x] **4.2** Visual check — single hero, no colored bands
- [x] **4.3** Streaming check — skeleton → cursor → completion (structure verified)
- [x] **4.4** Responsive check — desktop / medium / mobile layouts
- [x] **4.5** Sticky panel — headerRef + --panel-offset still works
- [x] **4.6** Overflow menu — all actions accessible
- [x] **4.7** Dark mode — semantic tokens only, no hardcoded colors
