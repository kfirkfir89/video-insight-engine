# Plan: Unified VideoHero — Merge Header + TLDR

Last Updated: 2026-02-19

---

## Executive Summary

Merge `VideoHeaderSection` and `TldrHero` into a single `VideoHero` component that presents all "about this video" information in one clean surface. This reduces cognitive load (2 visual zones → 1), eliminates competing backgrounds, and moves secondary actions behind an overflow menu.

---

## Current State Analysis

### Problem

The video detail page has two separate visual blocks at the top that represent the same concept — "the video in short":

1. **VideoHeaderSection** (153 lines) — `bg-primary/[0.12]` background, title, channel, colorful stat pills (blue/emerald/amber), thumbnail block, 4+ visible action buttons
2. **TldrHero** (61 lines) — different `bg-primary/[0.04]` gradient background, TL;DR text, key takeaways with CheckCircle icons

This creates:
- ~12 visible elements competing for attention
- 2 different background treatments creating visual noise
- Context-switching between zones
- Violates Gestalt Proximity (related info should be grouped)

### Current Consumers

| Component | Uses VideoHeaderSection | Uses TldrHero |
|-----------|:---:|:---:|
| `VideoDetailDesktop.tsx` | Yes (line 107) | Yes (line 189) |
| `VideoDetailMobile.tsx` | Yes (line 118) | Yes (line 126) |
| `VideoDetailLayout.tsx` | Yes (line 176, loading state) | No |

### Key Dependencies

- `formatDuration()`, `timeAgo()` — from `@/lib/string-utils` (already centralized)
- `VideoTags` — reused unchanged
- `Skeleton` from shadcn/ui — for streaming loading state
- `DropdownMenu` from shadcn/ui — already installed, used for overflow menu
- `forwardRef` — needed for `headerRef` used by Desktop sticky panel height calculation

---

## Proposed Future State

### Single `VideoHero` component (~200 lines)

```
[bg-background ────────────────────────────────────]
│ ← Back                     [Quick Read] [⋯]     │  ← nav row
│                                                   │
│ Title                             [faded thumb]  │  ← title
│ Channel · 12:34 · 8 chapters · 14 concepts · 5m │  ← inline metadata
│ #tag #tag                                         │
│ ─ ─ ─ ─ ─ ─ ─ fade-divider ─ ─ ─ ─ ─ ─ ─       │
│ TL;DR                                             │  ← summary
│ Summary text...                                   │
│ ✓ Takeaway 1  ✓ Takeaway 2  ✓ Takeaway 3        │
[fade-divider ─────────────────────────────────────]
```

**Key reductions:**
- Colored stat pills → inline text in breadcrumb (middot-separated)
- 4 visible action buttons → 1 primary + overflow `DropdownMenu`
- 2 background zones → 1 clean `bg-background` surface
- Thumbnail block → subtle ambient right-edge gradient fade

---

## Implementation Phases

### Phase 1: Create VideoHero Component

**Goal:** Build the unified component that replaces both old components.

#### Task 1.1: Create `VideoHero.tsx` (Effort: L)

**File:** `apps/web/src/components/video-detail/VideoHero.tsx`

**Props interface:**
```typescript
interface VideoHeroProps {
  video: VideoResponse;
  summary: VideoSummary | null;
  isStreaming: boolean;
  onStopSummarization?: () => void;
  thumbnailUrl?: string | null;
  backButton?: React.ReactNode;
  primaryAction?: React.ReactNode;   // Quick Read — always visible
  actions?: React.ReactNode;         // Overflow menu trigger
  className?: string;
}
```

**Internal structure (top → bottom):**
1. **Thumbnail accent** — `position: absolute` right edge, gradient fade from-background to transparent
2. **Nav row** — `backButton` slot left, streaming stop + `primaryAction` + `actions` right
3. **Title** — h1 linked to YouTube, ExternalLink icon on hover (reuse existing pattern)
4. **Inline breadcrumb** — Channel · duration · chapters · concepts · status — all plain `text-xs text-muted-foreground` with middot separators
5. **Tags** — `<VideoTags>` component (unchanged)
6. **Fade divider** — subtle gradient separator `h-px bg-gradient-to-r from-transparent via-border/50 to-transparent`
7. **TL;DR section** — label, summary text (with streaming cursor from TldrHero), key takeaways (CheckCircle icons)
8. **Bottom fade divider** — transition to chapter content

**Key decisions:**
- Uses `React.forwardRef` for `headerRef` (Desktop sticky panel height)
- `id="video-header"` preserved on `<header>` element for scroll targeting
- No colored backgrounds — uses `bg-background` (clean surface)
- Streaming cursor and skeleton logic absorbed from TldrHero

**Acceptance criteria:**
- [ ] Component renders all data from both old components
- [ ] `forwardRef` works for sticky panel height calculation
- [ ] Streaming states (skeleton, cursor, live indicator) work correctly
- [ ] Thumbnail fades with gradient at right edge
- [ ] Dark mode compatible (uses semantic tokens only)

### Phase 2: Integrate Into Desktop Layout

#### Task 2.1: Update `VideoDetailDesktop.tsx` (Effort: M)

**Changes:**
1. Replace imports: `VideoHeaderSection` + `TldrHero` → `VideoHero`
2. Remove the header wrapper div (`bg-primary/[0.12]`, line 105)
3. Remove the TLDR wrapper div (`bg-primary/[0.04]`, lines 187-197)
4. Create `primaryAction` = Quick Read button
5. Create `actions` = `DropdownMenu` with Copy/Export/Chat (overflow)
6. Render single `<VideoHero ref={headerRef} .../>` before the flex row
7. Keep `ref={headerRef}` for sticky panel height logic

**Acceptance criteria:**
- [ ] Single hero section replaces header + TLDR
- [ ] Quick Read button visible when masterSummary exists
- [ ] Overflow menu contains Copy, Export, Chat
- [ ] Sticky right panel height still works via forwardRef
- [ ] No colored background bands

#### Task 2.2: Update `VideoDetailMobile.tsx` (Effort: M)

**Changes:**
1. Replace imports: `VideoHeaderSection` + `TldrHero` → `VideoHero`
2. Remove the separate back button / actions row (lines 53-98)
3. Replace `<VideoHeaderSection>` + `<TldrHero>` (lines 118-130) with single `<VideoHero>`
4. Pass mobile actions (Copy/Download/Chat as icon buttons) via `actions` prop
5. Keep chat drawer overlay (lines 101-116) unchanged
6. Pass back button via `backButton` prop

**Acceptance criteria:**
- [ ] Single hero on mobile
- [ ] Back button + action icons in nav row
- [ ] Chat drawer still works
- [ ] No duplicate action buttons

### Phase 3: Update Loading State & Cleanup

#### Task 3.1: Update `VideoDetailLayout.tsx` (Effort: S)

**Changes:**
1. Replace `VideoHeaderSection` import → `VideoHero`
2. In loading state (lines 176-181): use `<VideoHero summary={null}>` instead of `<VideoHeaderSection>`
3. Back button stays as-is (it's above VideoHero in loading state)

**Acceptance criteria:**
- [ ] Loading state renders correctly with VideoHero
- [ ] No import errors

#### Task 3.2: Delete Old Components (Effort: S)

- Delete `apps/web/src/components/video-detail/VideoHeaderSection.tsx`
- Delete `apps/web/src/components/video-detail/TldrHero.tsx`

**Acceptance criteria:**
- [ ] No remaining imports of deleted files
- [ ] Build succeeds with `npm run build`

### Phase 4: Verification

#### Task 4.1: Visual + Functional Testing (Effort: M)

1. **Visual check:** Single unified hero, no colored bands
2. **Streaming check:** Skeleton → cursor → completion
3. **Responsive check:** Desktop (>=1280), medium (768-1280), mobile (<768)
4. **Sticky panel:** headerRef still works for dynamic height
5. **Navigation:** `id="video-header"` scroll targeting works
6. **Overflow menu:** All actions accessible (Copy, Export, Chat)
7. **Dark mode:** No hardcoded colors, all semantic tokens

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `headerRef` breaks sticky panel | Low | High | Use `forwardRef` on VideoHero, test scroll behavior |
| Missing action buttons after merge | Low | Medium | Overflow menu captures all secondary actions |
| Streaming states regress | Medium | High | Absorb all TldrHero streaming logic (skeleton, cursor, live indicator) |
| Scroll targeting breaks | Low | Medium | Preserve `id="video-header"` on `<header>` element |
| Mobile layout breaks | Low | High | Test responsive breakpoints explicitly |

---

## Success Metrics

- 2 components → 1 component (VideoHero)
- ~12 visible elements → ~7 visible elements
- 2 background zones → 1 clean surface
- 4 visible action buttons → 1 primary + overflow
- Total lines: ~244 (VideoHeaderSection 153 + TldrHero 61) → ~200 (VideoHero)
- Build succeeds, no TypeScript errors
- All existing E2E selectors preserved or updated

---

## Dependencies

- `DropdownMenu` from shadcn/ui (already installed)
- `MoreHorizontal` icon from lucide-react (for overflow trigger)
- `formatDuration`, `timeAgo` from `@/lib/string-utils` (already centralized)
- `VideoTags` component (unchanged)
- `Skeleton` from shadcn/ui (for streaming state)
