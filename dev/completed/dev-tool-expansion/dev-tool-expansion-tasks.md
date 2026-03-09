# Dev Tool Expansion - Task Checklist

**Status: ✅ COMPLETED**
**Completed**: 2026-02-05

## Phase 1: Infrastructure (Effort: S)

### 1.1 Directory Structure
- [x] Create `apps/web/src/lib/dev/` directory
- [x] Create `apps/web/src/lib/dev/index.ts` with barrel exports
- [x] Create `apps/web/src/pages/dev/` directory
- [x] Create `apps/web/src/components/dev/design-system/` directory
- [x] Create `apps/web/src/components/dev/video-examples/` directory

### 1.2 Mock Block Factories
- [x] Create `apps/web/src/lib/dev/mock-blocks.ts`
- [x] Add UUID generation (use crypto.randomUUID or uuid package)
- [x] Add factory: `createParagraphBlock(text: string)`
- [x] Add factory: `createBulletsBlock(items: string[], variant?: string)`
- [x] Add factory: `createNumberedBlock(items: string[], variant?: string)`
- [x] Add factory: `createDoDoNotBlock(do: string[], dont: string[])`
- [x] Add factory: `createExampleBlock(code: string, title?: string, explanation?: string)`
- [x] Add factory: `createCalloutBlock(style: CalloutStyle, text: string, variant?: string)`
- [x] Add factory: `createDefinitionBlock(term: string, meaning: string)`
- [x] Add factory: `createKeyValueBlock(items: {key: string, value: string}[], variant?: string)`
- [x] Add factory: `createComparisonBlock(left: {label, items}, right: {label, items}, variant?)`
- [x] Add factory: `createTimestampBlock(time: string, seconds: number, label: string)`
- [x] Add factory: `createQuoteBlock(text: string, attribution?: string, timestamp?: number)`
- [x] Add factory: `createStatisticBlock(items: {value, label, context?, trend?}[])`
- [x] Add factory: `createTranscriptBlock(lines: {time, seconds, text}[])`
- [x] Add factory: `createTimelineBlock(events: {date?, time?, title, description?}[])`
- [x] Add factory: `createToolListBlock(tools: {name, quantity?, notes?, checked?}[])`
- [x] Add factory: `createIngredientBlock(items: {name, amount?, unit?, notes?}[], servings?)`
- [x] Add factory: `createStepBlock(steps: {number, instruction, duration?, tips?}[])`
- [x] Add factory: `createNutritionBlock(items: {nutrient, amount, unit?, dailyValue?}[], servingSize?)`
- [x] Add factory: `createCodeBlock(code: string, language?: string, filename?: string)`
- [x] Add factory: `createTerminalBlock(command: string, output?: string)`
- [x] Add factory: `createFileTreeBlock(tree: FileTreeNode[])`
- [x] Add factory: `createLocationBlock(name: string, address?: string, description?: string)`
- [x] Add factory: `createItineraryBlock(days: {day, title?, activities[]}[])`
- [x] Add factory: `createCostBlock(items: {category, amount, notes?}[], total?, currency?)`
- [x] Add factory: `createProConBlock(pros: string[], cons: string[])`
- [x] Add factory: `createRatingBlock(score: number, maxScore: number, label?: string, breakdown?)`
- [x] Add factory: `createVerdictBlock(verdict, summary, bestFor?, notFor?)`
- [x] Add factory: `createExerciseBlock(exercises: {name, sets?, reps?, duration?, rest?, difficulty?, notes?}[])`
- [x] Add factory: `createWorkoutTimerBlock(intervals: {name, duration, type}[], rounds?)`
- [x] Add factory: `createQuizBlock(questions: {question, options[], correctIndex, explanation?}[])`
- [x] Add factory: `createFormulaBlock(latex: string, description?: string, inline?: boolean)`
- [x] Add factory: `createGuestBlock(guests: {name, title?, bio?, imageUrl?, socialLinks?}[])`

### 1.3 Dev Routes
- [x] Add lazy-loaded `DesignSystemPage` to `App.tsx` with `import.meta.env.DEV` guard
- [x] Add lazy-loaded `VideoExamplesPage` to `App.tsx` with `import.meta.env.DEV` guard
- [x] Create shell `apps/web/src/pages/dev/DesignSystemPage.tsx` with production guard
- [x] Create shell `apps/web/src/pages/dev/VideoExamplesPage.tsx` with production guard
- [x] Verify routes work at `/dev/design-system` and `/dev/video-examples`

---

## Phase 2: Design System Page - Tokens (Effort: M)

### 2.1 Color Palette
- [x] Create `apps/web/src/components/dev/design-system/ColorPalette.tsx`
- [x] Add production guard at top of file
- [x] Display semantic colors: background, foreground, card, popover, primary, secondary, muted, accent, destructive
- [x] Show light mode swatch with hex/oklch value
- [x] Show dark mode swatch with hex/oklch value
- [x] Add copy-to-clipboard for color values

### 2.2 Typography
- [x] Create `apps/web/src/components/dev/design-system/Typography.tsx`
- [x] Add production guard at top of file
- [x] Display text-xs through text-4xl with sample text
- [x] Show font-normal, font-medium, font-semibold, font-bold weights
- [x] Display line-height options

### 2.3 Spacing Scale
- [x] Create `apps/web/src/components/dev/design-system/SpacingScale.tsx`
- [x] Add production guard at top of file
- [x] Display spacing tokens 1-12 with visual boxes
- [x] Show pixel values alongside token names

### 2.4 Status Indicators
- [x] Create `apps/web/src/components/dev/design-system/StatusIndicators.tsx`
- [x] Add production guard at top of file
- [x] Display pending status with icon and color
- [x] Display processing status with icon and color
- [x] Display success status with icon and color
- [x] Display error status with icon and color

### 2.5 Category Accents
- [x] Create `apps/web/src/components/dev/design-system/CategoryAccents.tsx`
- [x] Add production guard at top of file
- [x] Display all 10 categories: cooking, coding, travel, reviews, fitness, education, podcast, diy, gaming, standard
- [x] Show --category-accent color swatch
- [x] Show --category-accent-soft color swatch
- [x] Show --category-surface color swatch
- [x] Test light and dark mode display

---

## Phase 3: Design System Page - Blocks (Effort: L)

### 3.1 Block Showcase Component
- [x] Create `apps/web/src/components/dev/design-system/BlockShowcase.tsx`
- [x] Add production guard at top of file
- [x] Create block card component with: name, type badge, description, preview
- [x] Add JSON toggle per block card
- [x] Group blocks by category (Universal, Cooking, Coding, etc.)
- [x] Add collapsible sections for each group

### 3.2 Universal Blocks (12)
- [x] Add paragraph block with sample preview
- [x] Add bullets block with sample preview
- [x] Add numbered block with sample preview
- [x] Add do_dont block with sample preview
- [x] Add example block with sample preview
- [x] Add callout block with all 5 styles (tip, warning, note, chef_tip, security)
- [x] Add definition block with sample preview
- [x] Add keyvalue block with sample preview
- [x] Add comparison block with sample preview
- [x] Add timestamp block with sample preview
- [x] Add quote block with sample preview
- [x] Add statistic block with sample preview

### 3.3 New Universal Blocks (3)
- [x] Add transcript block with sample preview
- [x] Add timeline block with sample preview
- [x] Add tool_list block with sample preview

### 3.4 Cooking Blocks (3)
- [x] Add ingredient block with sample preview
- [x] Add step block with sample preview
- [x] Add nutrition block with sample preview

### 3.5 Coding Blocks (3)
- [x] Add code block with sample preview (TypeScript syntax highlighting)
- [x] Add terminal block with sample preview
- [x] Add file_tree block with sample preview

### 3.6 Travel Blocks (3)
- [x] Add location block with sample preview
- [x] Add itinerary block with sample preview
- [x] Add cost block with sample preview

### 3.7 Review Blocks (3)
- [x] Add pro_con block with sample preview
- [x] Add rating block with sample preview
- [x] Add verdict block with sample preview

### 3.8 Fitness Blocks (2)
- [x] Add exercise block with sample preview
- [x] Add workout_timer block with sample preview

### 3.9 Education Blocks (2)
- [x] Add quiz block with sample preview
- [x] Add formula block with sample preview

### 3.10 Podcast Blocks (1)
- [x] Add guest block with sample preview

### 3.11 Block Index
- [x] Create `apps/web/src/components/dev/design-system/index.ts` with all exports

---

## Phase 4: Design System Page - Views (Effort: M)

### 4.1 View Showcase Component
- [x] Create `apps/web/src/components/dev/design-system/ViewShowcase.tsx`
- [x] Add production guard at top of file
- [x] Create view card component with: name, description, preview
- [x] Use mock chapter data for each view

### 4.2 All 10 Views
- [x] Add StandardView preview with mock data
- [x] Add CodeView preview with mock data
- [x] Add RecipeView preview with mock data
- [x] Add TravelView preview with mock data
- [x] Add ReviewView preview with mock data
- [x] Add FitnessView preview with mock data
- [x] Add EducationView preview with mock data
- [x] Add PodcastView preview with mock data
- [x] Add DIYView preview with mock data
- [x] Add GamingView preview with mock data

---

## Phase 5: Video Examples Page - Mock Data (Effort: L)

### 5.1 Mock Data Structure
- [x] Create `apps/web/src/lib/dev/mock-videos.ts`
- [x] Add production guard at top of file
- [x] Create helper: `createMockVideoResponse(category, overrides)`
- [x] Create helper: `createMockVideoSummary(category, chapters)`
- [x] Create helper: `createMockDescriptionAnalysis()`
- [x] Create helper: `createMockChapter(index, title, blocks)`

### 5.2 Cooking Mock Video
- [x] Create "Gordon Ramsay's Perfect Carbonara" mock
- [x] Add 5 chapters: Intro, Ingredients, Pasta Prep, Sauce, Plating
- [x] Include blocks: ingredient, step, nutrition, callout (chef_tip), timestamp

### 5.3 Coding Mock Video
- [x] Create "React 19 Hooks Complete Tutorial" mock
- [x] Add 5 chapters: What's New, Setup, useState, useEffect, Custom Hooks
- [x] Include blocks: code, terminal, file_tree, callout (tip), comparison

### 5.4 Fitness Mock Video
- [x] Create "30-Min Full Body HIIT Workout" mock
- [x] Add 5 chapters: Warm Up, Circuit 1, Circuit 2, Circuit 3, Cool Down
- [x] Include blocks: exercise, workout_timer, callout (safety), timestamp

### 5.5 Travel Mock Video
- [x] Create "7 Days in Japan Complete Guide" mock
- [x] Add 5 chapters: Planning, Tokyo, Nara, Kyoto, Budget
- [x] Include blocks: location, itinerary, cost, bullets, callout

### 5.6 Education Mock Video
- [x] Create "Quantum Computing Explained" mock
- [x] Add 5 chapters: Classical vs Quantum, Qubits, Superposition, Applications, Quiz
- [x] Include blocks: definition, formula, quiz, comparison, callout

### 5.7 Podcast Mock Video
- [x] Create "Lex Fridman #400: Naval Ravikant" mock
- [x] Add 5 chapters: Intro, Wealth, Happiness, Philosophy, Rapid Fire
- [x] Include blocks: guest, quote, transcript, bullets, timestamp

### 5.8 Reviews Mock Video
- [x] Create "iPhone 15 Pro Max 6-Month Review" mock
- [x] Add 5 chapters: Design, Camera, Performance, Battery, Verdict
- [x] Include blocks: rating, pro_con, verdict, comparison, statistic

### 5.9 Gaming Mock Video
- [x] Create "Elden Ring Beginner's Walkthrough" mock
- [x] Add 5 chapters: Character Creation, Limgrave, First Boss, Leveling, Tips
- [x] Include blocks: comparison, bullets, numbered, callout (strategy), timestamp

### 5.10 DIY Mock Video
- [x] Create "Build a Standing Desk from Scratch" mock
- [x] Add 5 chapters: Materials, Cutting, Assembly, Finishing, Final Result
- [x] Include blocks: tool_list, step, cost, callout (safety), bullets

### 5.11 Standard Mock Video
- [x] Create "Understanding the Stock Market 2024" mock
- [x] Add 5 chapters: Intro, Concepts, Analysis, Tips, Summary
- [x] Include blocks: paragraph, bullets, numbered, definition, statistic

### 5.12 Export All Mocks
- [x] Create `getAllMockVideos()` function returning all 10 mocks
- [x] Create `getMockVideo(category)` function returning specific mock

---

## Phase 6: Video Examples Page - UI (Effort: M)

### 6.1 Page Structure
- [x] Create `apps/web/src/pages/dev/VideoExamplesPage.tsx`
- [x] Add production guard at top of file
- [x] Add page header with title and description
- [x] Import mock videos from lib/dev/mock-videos

### 6.2 Category Tabs
- [x] Create `apps/web/src/components/dev/video-examples/CategoryTabs.tsx`
- [x] Add production guard at top of file
- [x] Display all 10 category tabs with icons
- [x] Add active tab styling with category accent color
- [x] Handle tab click to switch category

### 6.3 Video Example Component
- [x] Create `apps/web/src/components/dev/video-examples/CategoryVideoExample.tsx`
- [x] Add production guard at top of file
- [x] Render TldrHero with mock data
- [x] Render ChapterList with mock chapters
- [x] Render ArticleSection for each chapter
- [x] Apply `category-{name}` class for theming
- [x] Include ResourcesPanel with mock description analysis

### 6.4 Video Examples Index
- [x] Create `apps/web/src/components/dev/video-examples/index.ts` with exports

---

## Phase 7: Navigation & Polish (Effort: S)

### 7.1 DevToolPanel Links
- [x] Add "Dev Pages" section to DevToolPanel.tsx
- [x] Add link to /dev/design-system with icon
- [x] Add link to /dev/video-examples with icon

### 7.2 Design System Page Layout
- [x] Add sticky TOC sidebar with section links
- [x] Implement smooth scroll to sections
- [x] Add "Back to top" button

### 7.3 Theme Testing
- [x] Test all components in light mode
- [x] Test all components in dark mode
- [x] Fix any contrast issues

### 7.4 Production Verification
- [x] Run `npm run build` in apps/web
- [x] Verify no dev code in dist folder with grep
- [x] Verify bundle size unchanged from baseline
- [x] Test production build runs without errors

---

## Verification Checklist

### Development Mode
- [x] `/dev/design-system` loads without errors
- [x] `/dev/video-examples` loads without errors
- [x] All 31 blocks render correctly
- [x] All 10 views render correctly
- [x] All 10 category video examples load
- [x] Category tabs switch correctly
- [x] Light/dark mode works throughout
- [x] No console errors

### Production Build
- [x] `grep -r "DesignSystemPage" dist/` returns nothing
- [x] `grep -r "VideoExamplesPage" dist/` returns nothing
- [x] `grep -r "mock-data" dist/` returns nothing
- [x] `grep -r "mock-videos" dist/` returns nothing
- [x] `grep -r "/dev/" dist/` returns nothing
- [x] Bundle size not significantly increased

---

## Test Coverage

### Unit Tests (53 tests passing)
- [x] `mock-blocks.test.ts` - 37 tests for all block factories
- [x] `design-system.test.tsx` - 16 tests for token components

### E2E Tests (28 tests passing)
- [x] `dev-pages.spec.ts` - Full Playwright E2E coverage
  - Design System Page: 11 tests
  - Video Examples Page: 15 tests
  - Navigation: 2 tests

---

**Completed**: 2026-02-05
**Total Tasks**: 143/143 ✅
