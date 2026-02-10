# Design System UX Overhaul - Context

**Last Updated: 2026-02-05**

---

## Key Files

### Primary Targets
| File | Phase | Purpose |
|------|-------|---------|
| `apps/web/src/index.css` | 1 | Add semantic tokens + CSS utilities |
| `apps/web/src/components/video-detail/blocks/BlockWrapper.tsx` | 2 | Add variant system |

### Block Components (Phase 3)
All in `apps/web/src/components/video-detail/blocks/`:

**Group A - Code (variant="code")**
- `CodeBlock.tsx` - Syntax-highlighted code with copy button
- `TerminalBlock.tsx` - Terminal/CLI output display
- `ExampleBlock.tsx` - Code/terminal example with context

**Group B - Data Tables (variant="card")**
- `CostBlock.tsx` - Cost breakdown table
- `NutritionBlock.tsx` - Nutrition facts table
- `ComparisonRenderer.tsx` - Side-by-side comparisons

**Group C - Rating/Verdict (variant="card")**
- `RatingBlock.tsx` - Star rating with progress bars
- `VerdictBlock.tsx` - Recommendation verdict card

**Group D - Accent-Left (variant="accent")**
- `CalloutBlock.tsx` - Tips, warnings, notes, security, chef tips
- `QuoteRenderer.tsx` - Quoted text with attribution
- `DefinitionBlock.tsx` - Term definitions
- `TimelineBlock.tsx` - Chronological timeline (variant="transparent")

**Group E - Lists (variant="inline")**
- `BulletsBlock.tsx` - Bullet point lists
- `NumberedBlock.tsx` - Numbered lists
- `StepBlock.tsx` - Step-by-step instructions
- `ToolListBlock.tsx` - Tool/resource lists

**Group F - Interactive (variant="card")**
- `IngredientBlock.tsx` - Ingredient list with serving scaler
- `QuizBlock.tsx` - Interactive quiz with answers
- `WorkoutTimerBlock.tsx` - Workout timer display
- `ExerciseBlock.tsx` - Exercise details with difficulty

**Group G - Info Cards (variant="card")**
- `GuestBlock.tsx` - Guest/speaker info
- `LocationBlock.tsx` - Location details with links
- `ItineraryBlock.tsx` - Travel itinerary timeline
- `FileTreeBlock.tsx` - File/folder tree display
- `FormulaBlock.tsx` - Math formula display
- `TranscriptBlock.tsx` - Video transcript with timestamps

**Group H - Dual-Column (variant="card")**
- `DosDontsBlock.tsx` - Do/Don't comparison
- `ProConBlock.tsx` - Pro/Con comparison

**Group I - Minimal (variant="transparent")**
- `KeyValueRenderer.tsx` - Key-value pairs
- `StatisticRenderer.tsx` - Stat cards
- `TimestampRenderer.tsx` - Clickable timestamps

### View Components (Phase 4)
All in `apps/web/src/components/video-detail/views/`:
- `StandardView.tsx`, `RecipeView.tsx`, `TravelView.tsx`
- `ReviewView.tsx`, `FitnessView.tsx`, `EducationView.tsx`
- `PodcastView.tsx`, `DIYView.tsx`, `GamingView.tsx`, `CodeView.tsx`

### Showcase Components (Phase 5)
- `apps/web/src/components/dev/design-system/BlockShowcase.tsx`
- `apps/web/src/components/dev/design-system/ViewShowcase.tsx`
- `apps/web/src/components/dev/design-system/ColorPalette.tsx`
- `apps/web/src/lib/dev/mock-blocks.ts`

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Color system | OKLCH semantic tokens | Perceptually uniform, matches existing design system |
| CSS utilities | `@apply` classes in index.css | Reusable across blocks, single source of truth |
| BlockWrapper variants | 5 variants (card/inline/accent/code/transparent) | Covers all visual patterns found in 31 blocks |
| Header pattern | Auto-render in BlockWrapper | Consistent headers without repeating markup in each block |
| Backward compatibility | Default variant="card" | Existing blocks work without changes |
| Color replacement | Semantic tokens only | `text-success` not `text-emerald-600` |

---

## Dependencies

### Internal
- Phase 1 must complete before Phase 2 (CSS utilities needed)
- Phase 2 must complete before Phase 3 (BlockWrapper variants needed)
- Phase 3 can partially overlap with Phase 4 (views don't depend on all blocks)
- Phase 5 depends on Phase 3 completion (showcase displays updated blocks)
- Phase 6 runs after all other phases

### External
- No external dependencies
- All work is frontend-only (apps/web)
- No API or backend changes needed

---

## Current Hardcoded Colors to Replace

### Blocks
| Color Pattern | Semantic Replacement | Used In |
|---------------|---------------------|---------|
| `text-emerald-600`, `dark:text-emerald-400` | `text-success` | CodeBlock, DosDonts, ProCon, ToolList, Ingredient, Quiz, Verdict |
| `bg-emerald-500/10` | `bg-success-soft` | DosDonts, ProCon, Verdict, Exercise |
| `border-emerald-500/30` | `border-success/30` | DosDonts, ProCon, Verdict |
| `text-rose-600`, `dark:text-rose-400` | `text-destructive` | DosDonts, ProCon, Quiz, Verdict |
| `bg-rose-500/10` | `bg-destructive/10` | DosDonts, ProCon, Verdict, Exercise |
| `border-rose-500/30` | `border-destructive/30` | DosDonts, ProCon, Verdict |
| `text-amber-600`, `dark:text-amber-400` | `text-warning` | Verdict, Exercise |
| `bg-amber-500/10` | `bg-warning-soft` | Verdict, Exercise |
| `fill-amber-400 text-amber-400` | `fill-warning text-warning` | Rating, Quote |
| `border-amber-400/60` | `border-warning/60` | Callout (tip) |
| `border-rose-400/60` | `border-destructive/60` | Callout (warning, security) |
| `border-sky-400/60` | `border-info/60` | Callout (note) |
| `border-orange-400/60` | `border-warning/60` | Callout (chef_tip) |
| `text-amber-500 dark:text-amber-400` | `text-warning` | FileTree folder icons |
| `bg-zinc-950`, `bg-zinc-*` | `.block-code-container` | Terminal, Code |
| `bg-[var(--category-accent,#F59E0B)]` | `bg-warning` or `bg-[var(--category-accent)]` | Rating |
| `text-[var(--category-accent,#10B981)]` | `text-primary` | Location |

### Views
| Color Pattern | Semantic Replacement | Used In |
|---------------|---------------------|---------|
| `bg-amber-50/50 dark:bg-amber-950/20` | `bg-[var(--category-surface)]` | RecipeView |
| `border-amber-200/50 dark:border-amber-800/30` | `border-[var(--category-accent)]/20` | RecipeView |
| `text-amber-700 dark:text-amber-300` | `text-[var(--category-accent)]` | RecipeView |
| `bg-emerald-50/50 dark:bg-emerald-950/20` | `bg-[var(--category-surface)]` | RecipeView |
| Similar patterns | Category CSS variables | All other views |

---

## Design Scales Reference

| Context | Value | Token |
|---------|-------|-------|
| Card padding | `p-4` (16px) | Standard for all card blocks |
| Card inner gap | `space-y-3` | Between sections inside card |
| List item gap | `space-y-1.5` | Between items in lists |
| Card border radius | `rounded-xl` (12px) | All card containers |
| Header bottom border | `border-b border-border/30` | Separates header from content |
| Header margin bottom | `mb-3` | Below header border |
| Header icon | `h-4 w-4` | Lucide, `shrink-0` |
| Inline icon | `h-3.5 w-3.5` | Lucide, `shrink-0` |
| Header text | `text-xs font-semibold uppercase tracking-wider` | Distinctive label style |
| Body text | `text-sm` | All content text |
| Metadata text | `text-xs text-muted-foreground` | Secondary information |
| Border opacity | `border-border/40` | Outer borders |
| Hover border | `border-border/60` | On hover |
| Shadow | `shadow-sm` → `shadow-md` on hover | Subtle depth |

---

## New Semantic Token Values

### Light Mode (:root)
```css
--success: oklch(52% 0.14 145);
--success-foreground: oklch(98% 0.01 145);
--success-soft: oklch(96% 0.03 145);
--warning: oklch(78% 0.14 85);
--warning-foreground: oklch(25% 0.06 85);
--warning-soft: oklch(96% 0.03 85);
--info: oklch(62% 0.14 245);
--info-foreground: oklch(98% 0.01 245);
--info-soft: oklch(96% 0.03 245);
```

### Dark Mode (.dark)
```css
--success: oklch(68% 0.14 145);
--success-foreground: oklch(15% 0.05 145);
--success-soft: oklch(20% 0.04 145);
--warning: oklch(78% 0.12 85);
--warning-foreground: oklch(15% 0.05 85);
--warning-soft: oklch(20% 0.03 85);
--info: oklch(68% 0.12 245);
--info-foreground: oklch(15% 0.05 245);
--info-soft: oklch(20% 0.03 245);
```

---

## Category Tip Icons

| View | Tip Icon | Import |
|------|----------|--------|
| RecipeView | `ChefHat` | Already in project |
| TravelView | `Compass` | New import |
| ReviewView | `Lightbulb` | Keep |
| FitnessView | `Dumbbell` | Already in project |
| EducationView | `GraduationCap` | New import |
| PodcastView | `Mic` | New import |
| DIYView | `Wrench` | Already in project |
| GamingView | `Gamepad2` | New import |
| CodeView | `Code2` | Already in project |
| StandardView | `Lightbulb` | Keep |
