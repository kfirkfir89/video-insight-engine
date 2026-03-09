# Dev Tool Expansion: Design System & Video Examples Pages

**Status: ✅ COMPLETED** (2026-02-05)

## Executive Summary

Add two dev-only pages for component documentation and live previews:

1. **Design System Page** (`/dev/design-system`) - Colors, typography, spacing, status indicators, category accents, all 31 blocks, and all 10 views
2. **Video Examples Page** (`/dev/video-examples`) - Complete video pages with realistic mock data for all 10 categories

This provides a living style guide for developers to visualize components without needing real API data.

**Effort**: Large (L) - 4-5 developer-days
**Completed**: 2026-02-05

---

## Current State Analysis

### Existing Infrastructure
- `DevToolPanel.tsx` - Collapsible dev panel with LLM provider selection
- `ProviderSelector.tsx` - Provider dropdown component
- Dev guard pattern: `if (!import.meta.env.DEV) throw new Error(...)`
- Lazy loading pattern in `App.tsx` for route code splitting
- 31 content block types defined in `@vie/types`
- 10 category views implemented in `apps/web/src/components/video-detail/views/`
- Category CSS variables defined in `index.css` (`.category-*` classes)

### What's Missing
- No dev-only pages for component showcase
- No mock data factories for isolated testing
- No visual documentation of design tokens
- No way to see all blocks/views without real video data

---

## Proposed Future State

```
apps/web/src/
├── pages/
│   └── dev/                         # Dev-only pages (tree-shaken in prod)
│       ├── DesignSystemPage.tsx     # Design tokens + component showcase
│       └── VideoExamplesPage.tsx    # Full video examples per category
├── components/
│   └── dev/
│       ├── DevToolPanel.tsx         # Existing
│       ├── ProviderSelector.tsx     # Existing
│       ├── design-system/           # Design system showcase components
│       │   ├── index.ts
│       │   ├── ColorPalette.tsx
│       │   ├── Typography.tsx
│       │   ├── SpacingScale.tsx
│       │   ├── StatusIndicators.tsx
│       │   ├── CategoryAccents.tsx
│       │   ├── BlockShowcase.tsx
│       │   ├── ViewShowcase.tsx
│       │   └── UIComponentShowcase.tsx
│       └── video-examples/          # Video example components
│           ├── index.ts
│           ├── CategoryVideoExample.tsx
│           └── CategoryTabs.tsx
└── lib/
    └── dev/                         # Dev-only utilities
        ├── index.ts
        ├── mock-blocks.ts           # Factory functions for all 31 block types
        ├── mock-videos.ts           # Mock VideoResponse + VideoSummary per category
        └── mock-data.ts             # Re-exports and helpers
```

---

## Implementation Phases

### Phase 1: Infrastructure (Effort: S - 0.5 day)

Set up isolated dev module structure with routes and mock data factories.

**Tasks:**
1. Create `lib/dev/` directory structure
2. Create mock block factory functions for all 31 types
3. Add lazy-loaded dev routes to `App.tsx`
4. Create page component shells

**Acceptance Criteria:**
- [ ] `/dev/design-system` renders empty page shell
- [ ] `/dev/video-examples` renders empty page shell
- [ ] Routes tree-shaken from production build
- [ ] Mock block factories return valid typed data

### Phase 2: Design System Page - Tokens (Effort: M - 1 day)

Build design token documentation sections.

**Tasks:**
1. `ColorPalette.tsx` - Semantic colors (background, foreground, primary, muted, accent, destructive, border)
2. `Typography.tsx` - Text scale (xs through 4xl) with font weights
3. `SpacingScale.tsx` - Tailwind spacing tokens (1-12) with visual boxes
4. `StatusIndicators.tsx` - pending, processing, success, error with icons
5. `CategoryAccents.tsx` - 10 category accent/soft/surface colors

**Acceptance Criteria:**
- [ ] All semantic colors display with swatches (light + dark mode)
- [ ] Typography scale shows all sizes with examples
- [ ] Spacing scale shows visual boxes
- [ ] Status indicators show all 4 states
- [ ] Category accents show all 10 categories

### Phase 3: Design System Page - Blocks (Effort: L - 1.5 days)

Build block showcase with live previews.

**Tasks:**
1. `BlockShowcase.tsx` - Grid of all 31 blocks organized by category
2. Individual block cards with: name, type badge, description, use case, live preview
3. JSON toggle to show/hide raw block data
4. Group by: Universal (12), Cooking (3), Coding (3), Travel (3), Review (3), Fitness (2), Education (2), Podcast (1)

**Acceptance Criteria:**
- [ ] All 31 block types display with previews
- [ ] Blocks grouped by category
- [ ] JSON toggle works for each block
- [ ] All blocks render without errors

### Phase 4: Design System Page - Views (Effort: M - 0.5 day)

Build view showcase.

**Tasks:**
1. `ViewShowcase.tsx` - All 10 category views with mock chapter data
2. Show view name, description, and live preview

**Acceptance Criteria:**
- [ ] All 10 views render with mock data
- [ ] Views show correct category theming
- [ ] Views render full chapter content

### Phase 5: Video Examples Page - Mock Data (Effort: L - 1 day)

Create realistic mock video data for all 10 categories.

**Tasks:**
1. Create `mock-videos.ts` with factory functions for each category
2. Each mock includes: VideoResponse, VideoSummary, DescriptionAnalysis
3. 3-5 chapters per video with category-appropriate blocks
4. Realistic metadata (title, channel, duration, tags)

**Categories:**
- cooking: "Gordon Ramsay's Perfect Carbonara"
- coding: "React 19 Hooks Complete Tutorial"
- fitness: "30-Min Full Body HIIT Workout"
- travel: "7 Days in Japan Complete Guide"
- education: "Quantum Computing Explained"
- podcast: "Lex Fridman #400: Naval Ravikant"
- reviews: "iPhone 15 Pro Max 6-Month Review"
- gaming: "Elden Ring Beginner's Walkthrough"
- diy: "Build a Standing Desk from Scratch"
- standard: "Understanding the Stock Market 2024"

**Acceptance Criteria:**
- [ ] All 10 categories have complete mock data
- [ ] Each video has 3-5 chapters with realistic content
- [ ] Mock data passes TypeScript validation
- [ ] Blocks use category-appropriate types

### Phase 6: Video Examples Page - UI (Effort: M - 0.5 day)

Build video examples page with category tabs.

**Tasks:**
1. `VideoExamplesPage.tsx` - Main page with category tabs
2. `CategoryTabs.tsx` - Tab navigation for 10 categories
3. `CategoryVideoExample.tsx` - Full VideoDetailLayout with mock data
4. Apply `category-{name}` class for theming

**Acceptance Criteria:**
- [ ] All 10 category tabs display
- [ ] Tab switching loads correct mock video
- [ ] Full VideoDetailLayout renders with mock data
- [ ] Category theming applies correctly

### Phase 7: Navigation & Polish (Effort: S - 0.5 day)

Add navigation links and final polish.

**Tasks:**
1. Add "Dev Pages" section to DevToolPanel with links
2. Add sticky TOC sidebar to DesignSystemPage
3. Test light/dark mode for all components
4. Verify production exclusion

**Acceptance Criteria:**
- [ ] DevToolPanel shows links to both dev pages
- [ ] DesignSystemPage has working TOC navigation
- [ ] All components work in light + dark mode
- [ ] `npm run build` excludes all dev code

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Dev code leaks to production | Low | High | Use `import.meta.env.DEV` guards, verify with grep |
| Mock data diverges from types | Medium | Medium | Use TypeScript strict mode, import from `@vie/types` |
| Block renderers have edge cases | Medium | Low | Test each block individually, use defensive rendering |
| Performance with all blocks | Low | Low | Use virtualization if needed |

---

## Success Metrics

1. **Production Safety**: `grep -r "dev/" dist/` returns nothing
2. **Coverage**: All 31 blocks and 10 views documented
3. **Usability**: New developer can find any component within 30 seconds
4. **Accuracy**: Mock data matches real API response structure

---

## Dependencies

- Existing `ContentBlockRenderer` component
- Existing category view components (`CodeView`, `RecipeView`, etc.)
- `@vie/types` package for type definitions
- Tailwind v4 with category CSS variables

---

## Critical Files to Reference

| File | Purpose |
|------|---------|
| `packages/types/src/index.ts` | All 31 block type definitions |
| `apps/web/src/components/video-detail/ContentBlockRenderer.tsx` | Block rendering patterns |
| `apps/web/src/components/video-detail/ArticleSection.tsx` | View selection logic |
| `apps/web/src/components/video-detail/views/` | All 10 category views |
| `apps/web/src/index.css` | Category CSS variables |
| `apps/web/src/App.tsx` | Lazy loading route pattern |

---

## Notes

- This task is independent of other active tasks
- Uses existing component infrastructure
- No backend changes required
- Benefits all frontend development work going forward
