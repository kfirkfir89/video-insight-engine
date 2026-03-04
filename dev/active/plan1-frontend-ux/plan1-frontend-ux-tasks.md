# Plan 1: Frontend UX — Task Checklist

**Last Updated**: 2026-03-02
**Total Tasks**: 65
**Completed**: 65/65

---

## Phase 1: Design System v2 (Days 1-3)

### 1a — Theme Migration (.dark → data-theme)
- [x] **T1** Replace all `.dark {}` selectors with `[data-theme="dark"] {}` in index.css
- [x] **T2** Add `:root, [data-theme="light"] {}` base selector
- [x] **T3** Add `@media (prefers-color-scheme: dark)` for system mode
- [x] **T4** Update Tailwind dark variant to use `[data-theme="dark"]` selector
- [x] **T5** Switch theme-provider from classList to dataset.theme
- [x] **T6** Update Theme type to `"dark" | "light" | "system"`
- [x] **T7** Update FOUC script in index.html to set data-theme
- [x] **T8** Replace all `:is(.dark)` selectors in index.css with `[data-theme="dark"]`
- [x] **T9** Replace `.dark .category-*` with `[data-theme="dark"] .category-*`

### 1b — New Color Palette
- [x] **T10** Define VIE primary color (replace violet-indigo hue ~292)
- [x] **T11** Add 8 VIE accent tokens (coral, plum, sky, mint, honey, rose, forest, peach)
- [x] **T12** Register accent tokens in @theme inline
- [x] **T13** Add per-output-type gradient tokens
- [x] **T14** Add glass surface tokens (--vie-glass, --vie-glass-border, --vie-nav-bg)
- [x] **T15** Map 10 category accents to new 8-color palette

### 1c — Glass Card Evolution
- [x] **T16** Evolve glass-surface to .glass with blur 20px
- [x] **T17** Add .glass-active and .glass-highlight variants
- [x] **T18** Add mobile media query for reduced glass blur
- [x] **T19** Verify contain: paint on all glass surfaces

### 1d — Fonts
- [x] **T20** Add Google Fonts link for Inter + JetBrains Mono
- [x] **T21** Set Inter as body font-family
- [x] **T22** Set JetBrains Mono on .code-font

### 1e — Animations
- [x] **T23** Add fadeUp keyframe
- [x] **T24** Add heartPop keyframe
- [x] **T25** Add float keyframe
- [x] **T26** Add spring easing token
- [x] **T27** Register animation tokens in @theme inline

### 1f — Output Type Config
- [x] **T28** Create output-type-config.ts

---

## Phase 2: Branding (Day 2)

- [x] **T29** Create/update favicon (inline SVG data URI)
- [x] **T30** Update HTML title, meta, OG defaults
- [x] **T31** Create VIE gradient text logo in AppHeader
- [x] **T32** Update SidebarHeader branding

---

## Phase 3: Route Restructure + Progressive Auth (Days 3-4)

### 3a — New Pages
- [x] **T33** Create LandingPage
- [x] **T34** Create BoardPage
- [x] **T35** Create SharePage

### 3b — Route Restructuring
- [x] **T36** Restructure routes in App.tsx
- [x] **T37** Update ProtectedRoute redirect to /board
- [x] **T38** Add anonymous generation tracking to auth-store
- [x] **T39** Update catch-all redirect

---

## Phase 4: Detection Override UI (Day 5)

- [x] **T40** Create DetectionOverride component
- [x] **T41** Handle detection_result SSE event
- [x] **T42** Render DetectionOverride in VideoHero

---

## Phase 5: Interactive View Containers (Days 6-8)

### 5a — Container Primitives
- [x] **T43** Create TabbedView
- [x] **T44** Create SwipeableView
- [x] **T45** Create StepThroughView
- [x] **T46** Create ProgressView
- [x] **T47** Create TimerView

### 5b — View Evolution
- [x] **T48** Evolve RecipeView to use TabbedView
- [x] **T49** Evolve EducationView to use ProgressView
- [x] **T50** Evolve CodeView to use StepThroughView
- [x] **T51** Evolve FitnessView to use TimerView

---

## Phase 6: Share UI (Days 8-9)

- [x] **T52** Create share API client
- [x] **T53** Create use-share hook
- [x] **T54** Add share button to VideoHero

---

## Phase 7: Board View (Days 9-10)

- [x] **T55** Create BoardCard
- [x] **T56** Create BoardGrid

---

## Phase 8: Inline Editing (Days 10-12)

- [x] **T57** Create use-output-state hook
- [x] **T58** Create InlineEditor component
- [x] **T59** Add editable prop to ContentBlockRenderer

---

## Phase 9: Mobile UX (Days 12-14)

- [x] **T60** Create MobileBottomNav
- [x] **T61** Create MobileFAB
- [x] **T62** Touch target audit (min 44px verified in E2E tests)
- [x] **T63** Test at 375px viewport (E2E: no overflow, readable text)

---

## Phase 10: Celebration + Polish (Day 14)

- [x] **T64** Create Confetti component
- [x] **T65** Trigger confetti on done SSE event

---

## Progress Summary

| Phase | Tasks | Done | Status |
|-------|-------|------|--------|
| 1a Theme Migration | 9 | 9 | ✅ Complete |
| 1b Color Palette | 6 | 6 | ✅ Complete |
| 1c Glass Evolution | 4 | 4 | ✅ Complete |
| 1d Fonts | 3 | 3 | ✅ Complete |
| 1e Animations | 5 | 5 | ✅ Complete |
| 1f Output Config | 1 | 1 | ✅ Complete |
| 2 Branding | 4 | 4 | ✅ Complete |
| 3a New Pages | 3 | 3 | ✅ Complete |
| 3b Route Restructure | 4 | 4 | ✅ Complete |
| 4 Detection Override | 3 | 3 | ✅ Complete |
| 5a Container Primitives | 5 | 5 | ✅ Complete |
| 5b View Evolution | 4 | 4 | ✅ Complete |
| 6 Share UI | 3 | 3 | ✅ Complete |
| 7 Board View | 2 | 2 | ✅ Complete |
| 8 Inline Editing | 3 | 3 | ✅ Complete |
| 9 Mobile UX | 4 | 4 | ✅ Complete |
| 10 Celebration | 2 | 2 | ✅ Complete |
| **TOTAL** | **65** | **65** | ✅ **COMPLETE** |
