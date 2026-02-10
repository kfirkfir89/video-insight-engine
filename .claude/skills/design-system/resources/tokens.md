# Design Tokens

Color, spacing, and typography tokens for vie-web. All tokens defined in `apps/web/src/index.css`.

---

## Configuration

### Location

Tailwind v4 uses CSS-first configuration. **No `tailwind.config.js`**.

```
apps/web/src/index.css    ← All tokens defined here
├── :root { }             ← Light mode variables
├── .dark { }             ← Dark mode variables
├── @theme inline { }     ← Tailwind theme integration
├── .category-* { }       ← Category accent colors
└── @layer components { } ← Premium CSS utilities
```

### OKLCH Color Space

This project uses OKLCH (Oklab Lightness Chroma Hue) for perceptually uniform colors.

```css
/* Format: oklch(lightness chroma hue) */
--primary: oklch(55% 0.25 29);
/*              │    │    └─ Hue (0-360, red is ~29)
/*              │    └────── Chroma (0-0.4, saturation)
/*              └─────────── Lightness (0-100%) */
```

**Why OKLCH?**
- Consistent perceived brightness across hues
- Dark mode adjustments are intuitive (increase L)
- Better for generating color scales

---

## Core Semantic Colors

### Light Mode (Cool blue-gray undertones, hue ~250)

| Token | OKLCH Value | Usage |
|-------|-------------|-------|
| `--background` | `oklch(98% 0.004 250)` | Page background |
| `--foreground` | `oklch(18% 0.02 260)` | Primary text |
| `--card` | `oklch(99.5% 0.002 255)` | Card backgrounds |
| `--card-foreground` | `oklch(18% 0.02 260)` | Card text |
| `--popover` | `oklch(99.5% 0.002 255)` | Popover backgrounds |
| `--popover-foreground` | `oklch(18% 0.02 260)` | Popover text |
| `--primary` | `oklch(55% 0.25 29)` | Brand red, CTAs |
| `--primary-foreground` | `oklch(99% 0 0)` | Text on primary |
| `--secondary` | `oklch(94% 0.006 250)` | Secondary buttons |
| `--secondary-foreground` | `oklch(22% 0.015 255)` | Text on secondary |
| `--muted` | `oklch(95% 0.006 250)` | Muted backgrounds |
| `--muted-foreground` | `oklch(42% 0.02 255)` | Muted text |
| `--accent` | `oklch(96% 0.015 250)` | Hover states |
| `--accent-foreground` | `oklch(22% 0.015 255)` | Text on accent |
| `--destructive` | `oklch(55% 0.22 27)` | Error/delete actions |
| `--destructive-foreground` | `oklch(99% 0 0)` | Text on destructive |
| `--border` | `oklch(88% 0.008 250)` | Borders |
| `--input` | `oklch(88% 0.008 250)` | Input borders |
| `--ring` | `oklch(55% 0.25 29)` | Focus rings |
| `--radius` | `0.625rem` | Border radius |

### Dark Mode (Warm amber-brown undertones, hue ~55)

| Token | OKLCH Value | Notes |
|-------|-------------|-------|
| `--background` | `oklch(13% 0.025 55)` | Warm dark, cozy feel |
| `--foreground` | `oklch(94% 0.006 60)` | High contrast text |
| `--card` | `oklch(17% 0.022 55)` | Warm elevated surfaces |
| `--card-foreground` | `oklch(94% 0.006 60)` | Card text |
| `--popover` | `oklch(17% 0.022 55)` | Popover backgrounds |
| `--popover-foreground` | `oklch(94% 0.006 60)` | Popover text |
| `--primary` | `oklch(62.8% 0.258 29.23)` | Brighter red for dark |
| `--primary-foreground` | `oklch(99% 0 0)` | Text on primary |
| `--secondary` | `oklch(23% 0.015 55)` | Warm secondary |
| `--secondary-foreground` | `oklch(90% 0.006 60)` | Text on secondary |
| `--muted` | `oklch(21% 0.018 55)` | Warm subtle backgrounds |
| `--muted-foreground` | `oklch(65% 0.012 55)` | Readable muted text |
| `--accent` | `oklch(22% 0.02 55)` | Warm hover states |
| `--accent-foreground` | `oklch(90% 0.006 60)` | Text on accent |
| `--destructive` | `oklch(65% 0.22 27)` | Brighter red for dark |
| `--destructive-foreground` | `oklch(99% 0 0)` | Text on destructive |
| `--border` | `oklch(26% 0.015 55)` | Warm subtle border |
| `--input` | `oklch(21% 0.018 55)` | Input borders |
| `--ring` | `oklch(62.8% 0.258 29.23)` | Focus rings |

---

## Status Colors

Semantic colors for process states:

| Status | Token | Light Mode | Dark Mode |
|--------|-------|------------|-----------|
| Pending | `--status-pending` | `oklch(79.5% 0.18 86)` | `oklch(82% 0.16 86)` |
| Processing | `--status-processing` | `oklch(62% 0.21 250)` | `oklch(68% 0.19 250)` |
| Success | `--status-success` | `oklch(60% 0.15 145)` | `oklch(65% 0.14 145)` |
| Error | `--status-error` | `var(--destructive)` | `var(--destructive)` |

**Usage:**
```tsx
<span className="text-status-pending">Pending</span>
<span className="text-status-processing">Processing</span>
<span className="text-status-success">Completed</span>
<span className="text-status-error">Failed</span>

// Background variants
<div className="bg-status-success/10">Success message</div>
```

---

## Feedback Colors

Semantic colors for contextual feedback (callouts, badges, validation):

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--success` | `oklch(52% 0.14 145)` | `oklch(68% 0.14 145)` | Positive feedback |
| `--success-foreground` | `oklch(98% 0.01 145)` | `oklch(15% 0.05 145)` | Text on success |
| `--success-soft` | `oklch(96% 0.03 145)` | `oklch(20% 0.04 145)` | Soft success background |
| `--warning` | `oklch(78% 0.14 85)` | `oklch(78% 0.12 85)` | Caution/tip feedback |
| `--warning-foreground` | `oklch(25% 0.06 85)` | `oklch(15% 0.05 85)` | Text on warning |
| `--warning-soft` | `oklch(96% 0.03 85)` | `oklch(20% 0.03 85)` | Soft warning background |
| `--info` | `oklch(62% 0.14 245)` | `oklch(68% 0.12 245)` | Informational feedback |
| `--info-foreground` | `oklch(98% 0.01 245)` | `oklch(15% 0.05 245)` | Text on info |
| `--info-soft` | `oklch(96% 0.03 245)` | `oklch(20% 0.03 245)` | Soft info background |

**Usage:**
```tsx
// Text colors
<span className="text-success">Correct!</span>
<span className="text-warning">Caution</span>
<span className="text-info">Note</span>

// Soft backgrounds (callouts, badges)
<div className="bg-success-soft text-success">Pro item</div>
<div className="bg-warning-soft text-warning-foreground">Tip callout</div>
<div className="bg-info-soft text-info">Note callout</div>
```

---

## Premium Effect Tokens

Tokens that control glow intensity and spread, auto-adjusting per theme:

| Token | Light Mode | Dark Mode | Purpose |
|-------|------------|-----------|---------|
| `--glow-strength` | `0.12` | `0.3` | Opacity for glow box-shadows |
| `--glow-spread` | `12px` | `20px` | Blur radius for glow effects |

These tokens are consumed by the `glow-*` utility classes. Dark mode gets stronger, larger glows for visual bloom.

---

## Category Accent Colors

Content-type theming for visual categorization:

| Category | Accent (Hex) | Soft (Light) | Soft (Dark) |
|----------|--------------|--------------|-------------|
| cooking | `#FF6B35` | `rgba(255, 107, 53, 0.08)` | `rgba(255, 107, 53, 0.06)` |
| coding | `#22D3EE` | `rgba(34, 211, 238, 0.08)` | `rgba(34, 211, 238, 0.06)` |
| travel | `#10B981` | `rgba(16, 185, 129, 0.08)` | `rgba(16, 185, 129, 0.06)` |
| reviews | `#F59E0B` | `rgba(245, 158, 11, 0.08)` | `rgba(245, 158, 11, 0.06)` |
| fitness | `#EF4444` | `rgba(239, 68, 68, 0.08)` | `rgba(239, 68, 68, 0.06)` |
| education | `#8B5CF6` | `rgba(139, 92, 246, 0.08)` | `rgba(139, 92, 246, 0.06)` |
| podcast | `#EC4899` | `rgba(236, 72, 153, 0.08)` | `rgba(236, 72, 153, 0.06)` |
| gaming | `#6366F1` | `rgba(99, 102, 241, 0.08)` | `rgba(99, 102, 241, 0.06)` |
| diy | `#D97706` | `rgba(217, 119, 6, 0.08)` | `rgba(217, 119, 6, 0.06)` |
| standard | `#6B7280` | `rgba(107, 114, 128, 0.06)` | `rgba(107, 114, 128, 0.05)` |

### Using Category Colors

Apply category class to container, access variables in children:

```tsx
// Apply category class
<article className={`category-${persona.toLowerCase()}`}>
  {/* Access via CSS variables */}
  <div style={{
    color: "var(--category-accent)",
    backgroundColor: "var(--category-accent-soft)"
  }}>
    Category content
  </div>

  {/* Or via Tailwind arbitrary values */}
  <span className="text-[var(--category-accent)]">
    Accent text
  </span>
</article>
```

### Dark Mode Categories

Surface colors become translucent in dark mode (`rgba(accent, 0.04)`), maintaining contrast.

---

## Premium CSS Utilities

Utility classes defined in `@layer components` in `index.css`. These provide the unified design language across all block components.

### Block Surface Utilities

| Class | Purpose | Details |
|-------|---------|---------|
| `block-card` | Standard card surface | `rounded-xl p-5`, subtle shadow, hover translateY(-1px) + shadow lift |
| `block-accent` | Left-border accent variant | `rounded-lg border-l-[3px]`, muted background, used by callouts/quotes/definitions |
| `block-code-container` | Dark IDE-style surface | Dark gradient background, subtle inset glow, `rounded-xl` |
| `block-inline` | No border/bg, compact | `space-y-1.5`, used for lightweight inline content |
| `block-card-header` | Card header with separator | Flex row with icon + label + optional action, bottom border |
| `block-code-header` | Code block header bar | Semi-transparent bg, traffic light dots, filename label |

### Animation & Motion Utilities

| Class | Purpose | Details |
|-------|---------|---------|
| `stagger-children` | Cascading entrance animation | Add to parent; children get `fade-slide-up` with 50ms stagger delay (supports up to 15 children) |
| `hover-lift` | Subtle lift on hover | `translateY(-2px)` + shadow increase on hover |
| `hover-scale` | Scale on hover/active | `scale(1.02)` on hover, `scale(0.98)` on active |
| `block-entrance` | Single element entrance | `fade-slide-up` animation, use with `animationDelay` for index-based stagger |

### Visual Effect Utilities

| Class | Purpose | Details |
|-------|---------|---------|
| `glass-surface` | Frosted glass effect | `backdrop-blur(12px)`, translucent bg, subtle border. Dark mode adds glow |
| `text-gradient-primary` | Gradient text using primary | Linear gradient from primary to lighter shifted hue |
| `text-gradient-warm` | Warm gold/amber gradient | `oklch(75% 0.18 40)` to `oklch(82% 0.16 70)`, used for rating scores |
| `fade-divider` | Gradient horizontal separator | Transparent edges, fades in from sides. Use between list items |
| `fade-divider-vertical` | Gradient vertical separator | Same as fade-divider but vertical |
| `glow-primary` | Primary color box-shadow glow | Uses `--glow-strength` and `--glow-spread` tokens |
| `glow-success` | Success color box-shadow glow | Green glow, stronger in dark mode |
| `glow-warning` | Warning color box-shadow glow | Yellow glow, stronger in dark mode |
| `glow-destructive` | Destructive color box-shadow glow | Red glow, stronger in dark mode |

### Block-Specific Utilities

| Class | Purpose | Used By |
|-------|---------|---------|
| `pro-con-bar` | Flexbox bar for pro/con ratio | ProConBlock |
| `timeline-line` | Vertical gradient line | TimelineBlock, ItineraryBlock |
| `timeline-line-animated` | Animated vertical line | TimelineBlock |
| `timeline-dot` | Pulsing dot on first item | TimelineBlock |
| `definition-item` | Gradient left border + spacing | DefinitionBlock |
| `numbered-ghost` | Large faded number watermark | NumberedBlock |
| `step-connector` | Arrow connector between steps | StepBlock |
| `location-map-bg` | Topographic pattern overlay | LocationBlock |
| `location-compass` | Decorative compass symbol | LocationBlock |
| `quote-decorative-mark` | Large gradient quotation mark | QuoteRenderer |
| `code-traffic-light` | Colored dot (10px circle) | BlockWrapper code variant |
| `callout-gradient-tip` | Warning-soft gradient bg | CalloutBlock (tip) |
| `callout-gradient-warning` | Destructive gradient bg | CalloutBlock (warning) |
| `callout-gradient-note` | Info-soft gradient bg | CalloutBlock (note) |
| `callout-gradient-security` | Destructive gradient bg | CalloutBlock (security) |

---

## Dark Mode Glow Utilities

These classes apply glow effects **only in dark mode** (using `:is(.dark)` selector). They add `filter: drop-shadow()` for subtle luminance bloom on colored elements.

| Class | Effect | Used By |
|-------|--------|---------|
| `badge-glow-success` | Green glow on badges | ExerciseBlock (beginner difficulty) |
| `badge-glow-warning` | Yellow glow on badges | ExerciseBlock (intermediate difficulty) |
| `badge-glow-destructive` | Red glow on badges | ExerciseBlock (advanced difficulty) |
| `amount-badge-glow` | Primary glow on amount badges | IngredientBlock |
| `timer-glow` | Large primary glow on timer digits | WorkoutTimerBlock |
| `day-number-glow` | Primary glow on day numbers | ItineraryBlock |
| `avatar-glow` | Subtle ring glow on avatars | GuestBlock |

Additional dark mode enhancements (applied automatically via `:is(.dark)` selectors):
- `block-card:hover` — ambient bloom on card hover
- `glass-panel` — ambient glow halo
- `glass-section-header::before` — dot glow
- `timeline-line` — line glow
- `definition-item::before` — border glow
- `quote-decorative-mark` — text glow
- `numbered-ghost` — number bloom
- `step-connector::after` — connector glow
- `text-gradient-primary` / `text-gradient-warm` — text glow
- `pro-con-bar` — bar glow

---

## Spacing System

Tailwind's default spacing scale (4px base):

| Class | Value | Pixels | Use Case |
|-------|-------|--------|----------|
| `1` | `0.25rem` | 4px | Icon gaps |
| `2` | `0.5rem` | 8px | Tight spacing |
| `3` | `0.75rem` | 12px | |
| `4` | `1rem` | 16px | Default padding |
| `5` | `1.25rem` | 20px | Card padding (block standard) |
| `6` | `1.5rem` | 24px | Section spacing |
| `8` | `2rem` | 32px | Large gaps |
| `10` | `2.5rem` | 40px | |
| `12` | `3rem` | 48px | Page sections |

**Usage:**
```tsx
<div className="p-4">       {/* padding: 16px */}
<div className="gap-2">     {/* gap: 8px */}
<div className="mt-6">      {/* margin-top: 24px */}
<div className="space-y-4"> {/* vertical spacing: 16px */}
```

---

## Typography

### Font Sizes

| Class | Size | Line Height | Use |
|-------|------|-------------|-----|
| `text-xs` | 12px | 16px | Captions, badges, block headers |
| `text-sm` | 14px | 20px | Secondary text, block body |
| `text-base` | 16px | 24px | Body text |
| `text-lg` | 18px | 28px | Lead paragraphs |
| `text-xl` | 20px | 28px | H4 |
| `text-2xl` | 24px | 32px | H3 |
| `text-3xl` | 30px | 36px | H2 |
| `text-4xl` | 36px | 40px | H1 |

### Font Weights

| Class | Weight | Use |
|-------|--------|-----|
| `font-normal` | 400 | Body text |
| `font-medium` | 500 | Emphasis |
| `font-semibold` | 600 | Headings, block headers |
| `font-bold` | 700 | Strong emphasis |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `0.625rem` | Default (10px) |
| `rounded-sm` | `calc(var(--radius) - 4px)` | Small elements |
| `rounded-md` | `calc(var(--radius) - 2px)` | Medium |
| `rounded-lg` | `var(--radius)` | Cards, buttons |
| `rounded-xl` | `calc(var(--radius) + 4px)` | Block cards (standard) |
| `rounded-full` | `9999px` | Pills, avatars |

---

## How to Extend

### Adding a New Semantic Color

1. Add to `:root` in `index.css`:
```css
:root {
  --warning: oklch(75% 0.18 70);  /* Yellow-ish */
}
```

2. Add dark mode variant:
```css
.dark {
  --warning: oklch(80% 0.16 70);  /* Brighter for dark */
}
```

3. Register with Tailwind in `@theme inline`:
```css
@theme inline {
  --color-warning: var(--warning);
}
```

4. Use in components:
```tsx
<span className="text-warning">Warning text</span>
<div className="bg-warning/10">Warning background</div>
```

### Adding a New Category

1. Add light mode class:
```css
.category-music {
  --category-accent: #A855F7;
  --category-accent-soft: rgba(168, 85, 247, 0.08);
  --category-surface: #FAF5FF;
}
```

2. Add dark mode variant:
```css
.dark .category-music {
  --category-accent-soft: rgba(168, 85, 247, 0.06);
  --category-surface: rgba(168, 85, 247, 0.04);
}
```

3. Map persona in components that use categories

---

## Dark Mode Implementation

Theme switching via `.dark` class on `<html>`:

```tsx
// ThemeProvider handles class toggling
<html className={theme === "dark" ? "dark" : ""}>

// Styles automatically adapt
<div className="bg-card text-card-foreground">
  Automatically themed
</div>
```

### Patterns

```tsx
// Automatic (preferred)
<div className="bg-background text-foreground">
  Uses CSS variables
</div>

// Manual dark variants (when needed)
<div className="bg-white dark:bg-gray-900">
  Explicit overrides
</div>

// Opacity adjustments
<div className="bg-primary/10 dark:bg-primary/20">
  More visible in dark mode
</div>
```

---

## Anti-Patterns

```css
/* DON'T: Hardcoded colors */
.button { background: #3b82f6; }

/* DO: Semantic tokens */
.button { background: var(--primary); }

/* DON'T: Random spacing */
.section { padding: 23px 17px; }

/* DO: Scale values */
.section { padding: 1.5rem 1rem; } /* 24px 16px */

/* DON'T: Duplicate dark mode logic */
.card { background: white; }
.dark .card { background: #1f2937; }

/* DO: Single variable reference */
.card { background: var(--card); }

/* DON'T: Use text-gray-* for dark mode glow effects */
.badge { color: gray; }

/* DO: Use :is(.dark) glow utilities for dark mode luminance */
.badge { @apply badge-glow-success; }

/* DON'T: Skip stagger animation on list containers */
<ul>{items.map(...)}</ul>

/* DO: Add stagger-children to list parents with >3 items */
<ul className="stagger-children">{items.map(...)}</ul>

/* DON'T: Use muted-foreground for callout icons */
<Icon className="text-muted-foreground" />

/* DO: Match icon color to callout accentColor */
<Icon className="text-warning" />
```
