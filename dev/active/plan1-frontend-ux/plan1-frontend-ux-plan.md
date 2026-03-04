# Plan 1: Frontend — Design System + UX

**Last Updated**: 2026-03-02
**Status**: Ready for Implementation
**Effort**: XL (~14 developer-days)
**Depends On**: Plan 0 types (contracts)
**Produces**: Pure consumer — no outputs for other plans

---

## Executive Summary

Comprehensive frontend overhaul covering: design system v2 (theme migration, new color palette, glass evolution, fonts, animations), branding, route restructuring with progressive auth, detection override UI, interactive view containers, share UI, board view, inline editing, mobile UX, and celebration polish. This transforms the app from a functional dashboard into a polished consumer product.

---

## Current State Analysis

### What Exists
- **Theme**: `.dark` classList toggle, 2 modes (dark/light), no system mode
- **Colors**: OKLCH-based violet-indigo primary palette with 10 category accent classes
- **Glass**: `.glass-surface` (blur 12px) with `contain: paint`
- **Fonts**: System fonts only, no custom fonts
- **Routes**: 4 routes (/, /video/:id, /login, /register) — all protected except auth
- **Pages**: DashboardPage, VideoDetailPage, LoginPage, RegisterPage + 2 dev pages
- **Views**: 9 views (Standard, Code, Education, Fitness, Gaming, Podcast, Recipe, Review, Travel)
- **Hooks**: 28 hooks including use-summary-stream.ts (SSE), no share/editing hooks
- **Stores**: auth-store (Zustand+persist), ui-store (390 lines), processing-store
- **API**: 6 modules (client, auth, videos, folders, playlists, explain), no share API
- **Blocks**: 40+ block renderers with tests, FlowRowRenderer, container query grids
- **Layout**: Resizable sidebar + main content, AppHeader, no mobile bottom nav
- **Tests**: 942+ unit tests, 49+ e2e tests

### What's Missing (Gap Analysis)

| Gap | Plan Section | Priority |
|-----|-------------|----------|
| `data-theme` attribute instead of `.dark` class | 1.1 | P0 |
| "system" theme mode | 1.1 | P0 |
| VIE color palette (replaces violet-indigo) | 1.1 | P0 |
| 8 accent tokens (coral, plum, sky, etc.) | 1.1 | P1 |
| Glass evolution (blur 20px, active/highlight) | 1.1 | P1 |
| Google Fonts (Inter + JetBrains Mono) | 1.1 | P0 |
| `output-type-config.ts` | 1.1 | P1 |
| New keyframes (fadeUp, heartPop, float) | 1.1 | P2 |
| Favicon + branding | 1.2 | P2 |
| LandingPage (public) | 1.3 | P0 |
| BoardPage (masonry grid) | 1.3 | P1 |
| SharePage (public) | 1.3 | P1 |
| Route restructuring | 1.3 | P0 |
| Anonymous generation tracking | 1.3 | P2 |
| DetectionOverride component | 1.4 | P1 |
| `detection_result` SSE event | 1.4 | P1 |
| Container primitives (Tabbed, Swipeable, etc.) | 1.5 | P1 |
| View evolution (Recipe, Education, Code, Fitness) | 1.5 | P1 |
| Share API + hook + button | 1.6 | P1 |
| BoardCard + BoardGrid | 1.7 | P1 |
| InlineEditor + use-output-state | 1.8 | P2 |
| MobileBottomNav + MobileFAB | 1.9 | P1 |
| Confetti celebration | 1.10 | P2 |

---

## Proposed Future State

### Architecture After Implementation

```
Routes:
  /          → LandingPage (public, URL input, live examples)
  /board     → ProtectedRoute → BoardPage (Pinterest masonry)
  /video/:id → ProtectedRoute → VideoDetailPage (enhanced views)
  /s/:slug   → SharePage (public, read-only)
  /login     → LoginPage
  /register  → RegisterPage

Theme: data-theme="dark|light" + system auto-detect
Fonts: Inter (body) + JetBrains Mono (code)
Colors: VIE palette + 8 accent tokens + per-output gradients
Views: Container-based (tabbed, swipeable, step-through, progress, timer)
Mobile: Bottom nav + FAB + 44px touch targets
Editing: Inline contentEditable with undo/redo
Sharing: API + slug-based public URLs
```

---

## Implementation Phases

### Phase 1: Design System v2 (Days 1-3) — FOUNDATION

**Risk**: HIGH — touches every visual element. Must be done carefully.
**Strategy**: Parallel tracks for theme migration and color palette.

#### 1.1a Theme Migration (.dark → data-theme)

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 1 | Replace all `.dark {}` selectors with `[data-theme="dark"] {}` in index.css | `apps/web/src/index.css` | M |
| 2 | Add `:root, [data-theme="light"] {}` base selector | `apps/web/src/index.css` | S |
| 3 | Add `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {} }` | `apps/web/src/index.css` | S |
| 4 | Update Tailwind dark variant: `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *))` | `apps/web/src/index.css` | S |
| 5 | Switch theme-provider from `classList` to `dataset.theme` | `apps/web/src/components/theme-provider.tsx` | M |
| 6 | Update Theme type to `"dark" \| "light" \| "system"` | `apps/web/src/components/theme-context.ts` | S |
| 7 | Update FOUC script in index.html to set `data-theme` | `apps/web/index.html` | S |
| 8 | Replace `:is(.dark)` selectors throughout index.css | `apps/web/src/index.css` | M |
| 9 | Search & replace `.dark .category-*` with `[data-theme="dark"] .category-*` | `apps/web/src/index.css` | S |

**Acceptance**: Theme toggle works in all 3 modes. No visual regressions. System auto-detect follows OS preference.

#### 1.1b New Color Palette

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 10 | Define VIE primary color (replace violet-indigo hue ~292) | `apps/web/src/index.css` | M |
| 11 | Add 8 accent tokens: `--vie-coral`, `--vie-plum`, `--vie-sky`, `--vie-mint`, `--vie-honey`, `--vie-rose`, `--vie-forest`, `--vie-peach` | `apps/web/src/index.css` | M |
| 12 | Register accent tokens in `@theme inline {}` | `apps/web/src/index.css` | S |
| 13 | Add per-output-type gradient tokens | `apps/web/src/index.css` | M |
| 14 | Add glass surface tokens: `--vie-glass`, `--vie-glass-border`, `--vie-nav-bg` | `apps/web/src/index.css` | S |
| 15 | Map 10 category accents to new 8-color palette | `apps/web/src/index.css` | M |

#### 1.1c Glass Card Evolution

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 16 | Evolve `.glass-surface` (blur 12→20px) to `.glass` with new tokens | `apps/web/src/index.css` | S |
| 17 | Add `.glass-active`, `.glass-highlight` variants | `apps/web/src/index.css` | S |
| 18 | Add mobile media query: `backdrop-filter: blur(8px)` on mobile | `apps/web/src/index.css` | S |
| 19 | Maintain `contain: paint` on all glass surfaces | `apps/web/src/index.css` | S |

#### 1.1d Fonts

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 20 | Add Google Fonts `<link>` for Inter (variable) + JetBrains Mono (subset) | `apps/web/index.html` | S |
| 21 | Set `font-family: 'Inter', system-ui, sans-serif` on body | `apps/web/src/index.css` | S |
| 22 | Set JetBrains Mono on `.code-font` class | `apps/web/src/index.css` | S |

#### 1.1e Animations

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 23 | Add `fadeUp` keyframe | `apps/web/src/index.css` | S |
| 24 | Add `heartPop` keyframe | `apps/web/src/index.css` | S |
| 25 | Add `float` keyframe | `apps/web/src/index.css` | S |
| 26 | Add spring easing token: `--ease-spring: cubic-bezier(.34, 1.56, .64, 1)` | `apps/web/src/index.css` | S |
| 27 | Register animation tokens in `@theme inline {}` | `apps/web/src/index.css` | S |

#### 1.1f Output Type Config

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 28 | Create `output-type-config.ts` mapping OutputType → emoji, gradient, label, accent color | `apps/web/src/lib/output-type-config.ts` | M |

---

### Phase 2: Branding (Day 2) — IDENTITY

**Risk**: LOW — cosmetic changes, no logic.
**Can run in parallel with Phase 1.**

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 29 | Create/update favicon | `apps/web/public/favicon.ico` | S |
| 30 | Update HTML title, meta, OG defaults | `apps/web/index.html` | S |
| 31 | Create VIE gradient text logo in AppHeader | `apps/web/src/components/layout/AppHeader.tsx` | M |
| 32 | Update SidebarHeader branding | `apps/web/src/components/sidebar/SidebarHeader.tsx` | S |

---

### Phase 3: Route Restructure + Progressive Auth (Days 3-4) — ARCHITECTURE

**Risk**: MEDIUM — changes app navigation flow.
**Depends on**: Phase 1 (for design tokens in new pages).

#### 3a New Pages

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 33 | Create LandingPage — URL input, live example outputs, no auth | `apps/web/src/pages/LandingPage.tsx` | L |
| 34 | Create BoardPage — Pinterest grid (replaces Dashboard as home) | `apps/web/src/pages/BoardPage.tsx` | L |
| 35 | Create SharePage — public view of shared output | `apps/web/src/pages/SharePage.tsx` | M |

#### 3b Route Restructuring

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 36 | Restructure routes in App.tsx (/ → Landing, /board → Board, /s/:slug → Share) | `apps/web/src/App.tsx` | M |
| 37 | Update ProtectedRoute to redirect to /board instead of / | `apps/web/src/App.tsx` | S |
| 38 | Add anonymous generation tracking to auth-store | `apps/web/src/stores/auth-store.ts` | M |
| 39 | Update catch-all redirect (* → /) | `apps/web/src/App.tsx` | S |

---

### Phase 4: Detection Override UI (Day 5) — FEATURE

**Risk**: LOW — additive feature, no breaking changes.
**Depends on**: Summarizer sending `detection_result` SSE event.

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 40 | Create DetectionOverride component (dropdown: detected type + confidence + override) | `apps/web/src/components/video-detail/DetectionOverride.tsx` | M |
| 41 | Handle `detection_result` SSE event in use-summary-stream.ts | `apps/web/src/hooks/use-summary-stream.ts` | M |
| 42 | Render DetectionOverride in VideoHero | `apps/web/src/components/video-detail/VideoHero.tsx` | S |

---

### Phase 5: Interactive View Containers (Days 6-8) — CORE UX

**Risk**: MEDIUM — evolves existing views, must preserve useGroupedBlocks rules.
**Depends on**: Phase 1 (glass tokens, animations).

#### 5a Container Primitives

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 43 | Create TabbedView — glass pill tabs, mobile-swipeable | `apps/web/src/components/video-detail/containers/TabbedView.tsx` | L |
| 44 | Create SwipeableView — touch gesture nav between sections | `apps/web/src/components/video-detail/containers/SwipeableView.tsx` | L |
| 45 | Create StepThroughView — "Step 1 of 8" navigator | `apps/web/src/components/video-detail/containers/StepThroughView.tsx` | M |
| 46 | Create ProgressView — completion tracking bar | `apps/web/src/components/video-detail/containers/ProgressView.tsx` | M |
| 47 | Create TimerView — timer integration wrapper | `apps/web/src/components/video-detail/containers/TimerView.tsx` | M |

#### 5b View Evolution (keep useGroupedBlocks, replace LayoutRow with containers)

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 48 | Evolve RecipeView → TabbedView(Ingredients \| Steps \| Nutrition) | `apps/web/src/components/video-detail/views/RecipeView.tsx` | L |
| 49 | Evolve EducationView → ProgressView(Chapters \| Quiz) | `apps/web/src/components/video-detail/views/EducationView.tsx` | L |
| 50 | Evolve CodeView → StepThroughView | `apps/web/src/components/video-detail/views/CodeView.tsx` | M |
| 51 | Evolve FitnessView → TimerView | `apps/web/src/components/video-detail/views/FitnessView.tsx` | M |

---

### Phase 6: Share UI (Days 8-9) — FEATURE

**Risk**: LOW — new API endpoint + UI, no breaking changes.
**Depends on**: API share endpoint (Plan 2).

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 52 | Create share API client | `apps/web/src/api/share.ts` | S |
| 53 | Create use-share hook | `apps/web/src/hooks/use-share.ts` | M |
| 54 | Add share button to VideoHero | `apps/web/src/components/video-detail/VideoHero.tsx` | S |

---

### Phase 7: Board View (Days 9-10) — FEATURE

**Risk**: LOW — new components.
**Depends on**: Phase 3 (BoardPage exists).

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 55 | Create BoardCard — output card with gradient + emoji + TLDR | `apps/web/src/components/board/BoardCard.tsx` | M |
| 56 | Create BoardGrid — CSS columns masonry | `apps/web/src/components/board/BoardGrid.tsx` | M |

---

### Phase 8: Inline Editing (Days 10-12) — FEATURE

**Risk**: HIGH — mutable state, undo/redo, contentEditable is notoriously tricky.
**Depends on**: None (can start independently).

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 57 | Create use-output-state hook — mutable block state, diff tracking, undo/redo | `apps/web/src/hooks/use-output-state.ts` | L |
| 58 | Create InlineEditor — contentEditable wrapper | `apps/web/src/components/video-detail/InlineEditor.tsx` | L |
| 59 | Add `editable` prop to ContentBlockRenderer | `apps/web/src/components/video-detail/ContentBlockRenderer.tsx` | M |

---

### Phase 9: Mobile UX (Days 12-14) — POLISH

**Risk**: MEDIUM — layout changes, touch target audit.
**Depends on**: Phase 3 (routes for nav).

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 60 | Create MobileBottomNav — Home, Create, Board, Profile | `apps/web/src/components/layout/MobileBottomNav.tsx` | M |
| 61 | Create MobileFAB — floating "+" button | `apps/web/src/components/layout/MobileFAB.tsx` | S |
| 62 | Touch target audit: ensure 44x44px minimums across all interactive elements | Multiple | M |
| 63 | Test at 375px viewport width | Multiple | M |

---

### Phase 10: Celebration + Polish (Day 14) — DELIGHT

**Risk**: LOW — purely additive.
**Depends on**: Phase 1 (animation tokens).

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 64 | Create Confetti component — CSS-only confetti burst | `apps/web/src/components/ui/Confetti.tsx` | M |
| 65 | Trigger confetti on `done` SSE event in use-summary-stream.ts | `apps/web/src/hooks/use-summary-stream.ts` | S |

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Theme migration breaks existing styles | HIGH | MEDIUM | Run full e2e test suite after migration. Search for all `.dark` references. |
| contentEditable cross-browser issues | MEDIUM | HIGH | Limit inline editing to text blocks only. Use `execCommand` cautiously. Consider Tiptap if needed. |
| Glass blur performance on mobile | LOW | MEDIUM | Media query reduces blur to 8px on mobile. `contain: paint` already in place. |
| Share API not ready (Plan 2 dependency) | MEDIUM | LOW | Build share UI with mock API client, swap when ready. |
| Route change breaks bookmarks | LOW | LOW | Add redirects from old routes to new ones. |
| Font loading delays (CLS) | MEDIUM | MEDIUM | Use `font-display: swap`, preload critical weights. |

---

## Success Metrics

1. **Theme**: All 3 modes work (dark, light, system). No `.dark` class references remain.
2. **Visual**: VIE palette applied consistently. Glass effects smooth at 60fps.
3. **Routes**: 6 routes functional. Landing page loads without auth. Share pages accessible publicly.
4. **Views**: 4 priority views use container primitives. Mobile swipe works.
5. **Performance**: Lighthouse score ≥ 90. No CLS from font loading.
6. **Mobile**: All touch targets ≥ 44px. Bottom nav renders at 375px.
7. **Tests**: All existing 942+ unit tests pass. All 49+ e2e tests pass. New components have tests.

---

## Dependencies

### External (from other plans)
- **Plan 0 types**: OutputType, detection types needed for output-type-config.ts
- **Plan 2 API**: Share endpoint needed for share UI (can mock initially)
- **Summarizer**: `detection_result` SSE event for DetectionOverride

### Internal (between phases)
```
Phase 1 (Design System) ──┬──→ Phase 3 (Routes)
                          ├──→ Phase 5 (Containers)
                          └──→ Phase 10 (Celebration)
Phase 2 (Branding)       ────→ Independent
Phase 3 (Routes)         ────→ Phase 7 (Board), Phase 9 (Mobile)
Phase 4 (Detection)      ────→ Independent (needs backend SSE event)
Phase 6 (Share)          ────→ Independent (needs API)
Phase 8 (Inline Editing) ────→ Independent
```

---

## Timeline

| Days | Phase | Effort | Can Parallelize With |
|------|-------|--------|---------------------|
| 1-3 | Phase 1: Design System v2 | L | Phase 2 (Day 2) |
| 2 | Phase 2: Branding | S | Phase 1 |
| 3-4 | Phase 3: Routes + Progressive Auth | L | — |
| 5 | Phase 4: Detection Override | M | — |
| 6-8 | Phase 5: Interactive View Containers | L | — |
| 8-9 | Phase 6: Share UI | M | — |
| 9-10 | Phase 7: Board View | M | — |
| 10-12 | Phase 8: Inline Editing | L | — |
| 12-14 | Phase 9: Mobile UX | M | — |
| 14 | Phase 10: Celebration + Polish | S | — |
