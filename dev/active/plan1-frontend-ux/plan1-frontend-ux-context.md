# Plan 1: Frontend UX — Context

**Last Updated**: 2026-03-02

---

## Key Files

### Theme System (Phase 1a)
| File | Purpose | Lines | Notes |
|------|---------|-------|-------|
| `apps/web/src/index.css` | All CSS tokens, keyframes, components | ~1317 | Main target for theme migration |
| `apps/web/src/components/theme-provider.tsx` | Theme switching logic | ~60 | Uses classList → needs dataset.theme |
| `apps/web/src/components/theme-context.ts` | Theme type + context | ~15 | `"dark" \| "light"` → add `"system"` |
| `apps/web/index.html` | FOUC prevention script | ~30 | Inline script sets theme before React |

### Color & Design Tokens (Phase 1b-1e)
| File | Purpose | Notes |
|------|---------|-------|
| `apps/web/src/index.css` `:root` | Light mode tokens | Lines 10-56 |
| `apps/web/src/index.css` `.dark` | Dark mode tokens | Lines 58-100 |
| `apps/web/src/index.css` `@theme inline` | Tailwind token registration | Lines 102-148 |
| `apps/web/src/index.css` keyframes | Animations | Lines 155-225 |
| `apps/web/src/index.css` `.category-*` | Category accent classes | Lines 253-353 |
| `apps/web/src/index.css` `.glass-surface` | Glass effect | Lines 978-990 |

### Routing & Pages (Phase 3)
| File | Purpose | Notes |
|------|---------|-------|
| `apps/web/src/App.tsx` | Route definitions | 162 lines, 4 routes currently |
| `apps/web/src/pages/DashboardPage.tsx` | Current home (protected) | Will be replaced by BoardPage |
| `apps/web/src/stores/auth-store.ts` | Auth state + persistence | 109 lines, Zustand |

### Video Detail (Phases 4-5)
| File | Purpose | Notes |
|------|---------|-------|
| `apps/web/src/components/video-detail/VideoHero.tsx` | Video header | 234 lines, add DetectionOverride + share button |
| `apps/web/src/hooks/use-summary-stream.ts` | SSE streaming | 584 lines, add detection_result event |
| `apps/web/src/components/video-detail/views/RecipeView.tsx` | Recipe layout | Evolve to TabbedView |
| `apps/web/src/components/video-detail/views/EducationView.tsx` | Education layout | Evolve to ProgressView |
| `apps/web/src/components/video-detail/views/CodeView.tsx` | Code layout | Evolve to StepThroughView |
| `apps/web/src/components/video-detail/views/FitnessView.tsx` | Fitness layout | Evolve to TimerView |
| `apps/web/src/components/video-detail/ContentBlockRenderer.tsx` | Block dispatch | Add editable prop |

### Layout (Phase 9)
| File | Purpose | Notes |
|------|---------|-------|
| `apps/web/src/components/layout/Layout.tsx` | Main layout | 145 lines, sidebar + content |
| `apps/web/src/components/layout/AppHeader.tsx` | App header | Update branding |

### Sidebar (Phase 2)
| File | Purpose | Notes |
|------|---------|-------|
| `apps/web/src/components/sidebar/SidebarHeader.tsx` | Branding | 18 lines, Sparkles icon + text |

---

## Files to Create

| File | Phase | Purpose |
|------|-------|---------|
| `apps/web/src/lib/output-type-config.ts` | 1.1f | OutputType → emoji, gradient, label, accent |
| `apps/web/src/pages/LandingPage.tsx` | 3a | Public homepage with URL input |
| `apps/web/src/pages/BoardPage.tsx` | 3a | Pinterest-style masonry grid |
| `apps/web/src/pages/SharePage.tsx` | 3a | Public share view |
| `apps/web/src/components/video-detail/DetectionOverride.tsx` | 4 | Output type selector dropdown |
| `apps/web/src/components/video-detail/containers/TabbedView.tsx` | 5a | Glass pill tabs |
| `apps/web/src/components/video-detail/containers/SwipeableView.tsx` | 5a | Touch gesture nav |
| `apps/web/src/components/video-detail/containers/StepThroughView.tsx` | 5a | Step counter |
| `apps/web/src/components/video-detail/containers/ProgressView.tsx` | 5a | Completion tracking |
| `apps/web/src/components/video-detail/containers/TimerView.tsx` | 5a | Timer wrapper |
| `apps/web/src/api/share.ts` | 6 | Share API client |
| `apps/web/src/hooks/use-share.ts` | 6 | Share hook |
| `apps/web/src/components/board/BoardCard.tsx` | 7 | Board card component |
| `apps/web/src/components/board/BoardGrid.tsx` | 7 | Masonry grid |
| `apps/web/src/hooks/use-output-state.ts` | 8 | Mutable state + undo/redo |
| `apps/web/src/components/video-detail/InlineEditor.tsx` | 8 | contentEditable wrapper |
| `apps/web/src/components/layout/MobileBottomNav.tsx` | 9 | Bottom navigation |
| `apps/web/src/components/layout/MobileFAB.tsx` | 9 | Floating action button |
| `apps/web/src/components/ui/Confetti.tsx` | 10 | CSS-only confetti |

---

## Architecture Decisions

### 1. Theme Migration Strategy
**Decision**: Replace `.dark` class with `[data-theme="dark"]` attribute
**Rationale**: Enables "system" mode via CSS media queries without JS. Attribute selectors are more explicit than class names. Tailwind v4 dark variant supports custom selectors.
**Impact**: Must update all `:is(.dark)` selectors in index.css (~30+ occurrences) and the `@custom-variant dark` directive.

### 2. Tailwind Dark Variant Update
**Current**: `@custom-variant dark (&:where(.dark, .dark *));`
**New**: `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));`
**Impact**: All existing `dark:` utility classes will automatically work with new selector.

### 3. System Theme Detection
**Approach**: CSS `@media (prefers-color-scheme: dark)` with `:root:not([data-theme="light"])` fallback
**Rationale**: When theme is "system", no `data-theme` attribute is set, allowing CSS media query to control. Explicit light/dark overrides via attribute take precedence.

### 4. Glass Evolution (not replacement)
**Decision**: Keep `.glass-surface` (backward compat), add `.glass` (new 20px blur)
**Rationale**: Existing glass usage shouldn't break. New components use `.glass`.

### 5. Route Restructure
**Decision**: Landing page at `/`, dashboard becomes `/board`
**Impact**: Logged-in users redirected to `/board`. ProtectedRoute fallback changes from `/` to `/board`.

### 6. Container Primitives Over View Rewrites
**Decision**: Create reusable container components, then compose into views
**Rationale**: TabbedView, SwipeableView etc. are reusable across all views. Views retain their grouping logic (useGroupedBlocks) but swap layout containers.

### 7. Inline Editing Scope
**Decision**: Text blocks only (paragraphs, headings, lists). Not code blocks or complex structures.
**Rationale**: contentEditable with code/tables is extremely complex. Start simple, expand later.

---

## Design Token Mapping

### Current Primary (to be replaced)
```css
--primary: oklch(58% 0.24 292);        /* Light: violet */
--primary: oklch(68% 0.26 292);        /* Dark: brighter violet */
```

### Proposed VIE Accent Tokens
```css
--vie-coral:  oklch(72% 0.18 25);
--vie-plum:   oklch(52% 0.20 310);
--vie-sky:    oklch(72% 0.14 230);
--vie-mint:   oklch(78% 0.14 165);
--vie-honey:  oklch(82% 0.15 80);
--vie-rose:   oklch(68% 0.16 350);
--vie-forest: oklch(55% 0.12 145);
--vie-peach:  oklch(82% 0.10 55);
```
*Note: Final values TBD based on visual testing*

### Category → Accent Mapping
```
cooking   → vie-coral
coding    → vie-sky
travel    → vie-forest
reviews   → vie-honey
fitness   → vie-rose
education → vie-plum
podcast   → vie-peach
gaming    → vie-sky (shared with coding, different gradient)
diy       → vie-honey (shared with reviews)
standard  → muted-foreground
```

---

## SSE Event Addition

### detection_result Event Format (Phase 4)
```typescript
// New event to handle in use-summary-stream.ts
interface DetectionResultEvent {
  type: 'detection_result';
  data: {
    detected_type: string;     // e.g., "cooking"
    confidence: number;        // 0-1
    alternatives: Array<{
      type: string;
      confidence: number;
    }>;
  };
}
```

### StreamState Addition
```typescript
// Add to StreamState interface
detectionResult?: {
  detectedType: string;
  confidence: number;
  alternatives: Array<{ type: string; confidence: number }>;
};
```

---

## Dependencies on Other Plans

| Dependency | Plan | Required By | Fallback |
|-----------|------|-------------|----------|
| OutputType enum | Plan 0 | Phase 1 (output-type-config.ts) | Use string literals initially |
| Share API endpoint | Plan 2 | Phase 6 (share UI) | Mock API client |
| `detection_result` SSE event | Plan 3 (summarizer) | Phase 4 | Static dropdown without live detection |

---

## Testing Strategy

### Unit Tests (Vitest)
- Theme provider: all 3 modes, persistence, FOUC prevention
- output-type-config.ts: mapping completeness
- use-share.ts: API calls, error handling
- use-output-state.ts: mutations, undo/redo, diff tracking
- DetectionOverride: dropdown behavior, override callback
- Container primitives: tab switching, step navigation, progress tracking

### E2E Tests (Playwright)
- Theme toggle: dark → light → system
- Route navigation: landing → login → board → video detail
- Share flow: generate link, open in incognito
- Mobile: bottom nav, FAB, touch targets at 375px

### Visual Regression
- Screenshot comparison before/after theme migration
- Glass effects in both themes
- Font rendering (Inter + JetBrains Mono)

---

## Related Active Tasks

| Task | Overlap | Resolution |
|------|---------|------------|
| `design-system-ux-overhaul` | Color palette, glass effects | This plan supersedes |
| `frontend-refactor` | Component splits | Do refactor first, then this plan |
| `block-ux-v2` | View containers | This plan's Phase 5 overlaps, coordinate |
| `sidebar-header-redesign` | SidebarHeader branding | Phase 2 covers this |
| `video-hero-merge` | VideoHero changes | Coordinate with Phase 4 (DetectionOverride) |
