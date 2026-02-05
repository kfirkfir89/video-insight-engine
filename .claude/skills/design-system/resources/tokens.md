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
└── .category-* { }       ← Category accent colors
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

### Light Mode

| Token | OKLCH Value | Usage |
|-------|-------------|-------|
| `--background` | `oklch(99% 0 0)` | Page background |
| `--foreground` | `oklch(3% 0 0)` | Primary text |
| `--card` | `oklch(100% 0 0)` | Card backgrounds |
| `--card-foreground` | `oklch(3% 0 0)` | Card text |
| `--primary` | `oklch(55% 0.25 29)` | Brand red, CTAs |
| `--primary-foreground` | `oklch(100% 0 0)` | Text on primary |
| `--secondary` | `oklch(95% 0 0)` | Secondary buttons |
| `--secondary-foreground` | `oklch(5% 0 0)` | Text on secondary |
| `--muted` | `oklch(96% 0 0)` | Muted backgrounds |
| `--muted-foreground` | `oklch(25% 0 0)` | Muted text |
| `--accent` | `oklch(96% 0.02 29)` | Hover states |
| `--accent-foreground` | `oklch(5% 0 0)` | Text on accent |
| `--destructive` | `oklch(55% 0.25 27)` | Error/delete actions |
| `--border` | `oklch(85% 0 0)` | Borders |
| `--input` | `oklch(85% 0 0)` | Input borders |
| `--ring` | `oklch(55% 0.25 29)` | Focus rings |
| `--radius` | `0.625rem` | Border radius |

### Dark Mode

| Token | OKLCH Value | Notes |
|-------|-------------|-------|
| `--background` | `oklch(13.5% 0 0)` | YouTube-dark inspired |
| `--foreground` | `oklch(95.7% 0 0)` | High contrast text |
| `--card` | `oklch(18% 0 0)` | Elevated surfaces |
| `--primary` | `oklch(62.8% 0.258 29.23)` | Brighter red for dark |
| `--muted` | `oklch(22% 0 0)` | Subtle backgrounds |
| `--muted-foreground` | `oklch(65% 0 0)` | Readable muted text |
| `--border` | `oklch(28% 0 0)` | Visible but subtle |

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

## Category Accent Colors

Content-type theming for visual categorization:

| Category | Accent (Hex) | Soft | Surface (Light) |
|----------|--------------|------|-----------------|
| cooking | `#FF6B35` | `rgba(255, 107, 53, 0.12)` | `#FFF7ED` |
| coding | `#22D3EE` | `rgba(34, 211, 238, 0.12)` | `#ECFEFF` |
| travel | `#10B981` | `rgba(16, 185, 129, 0.12)` | `#ECFDF5` |
| reviews | `#F59E0B` | `rgba(245, 158, 11, 0.12)` | `#FFFBEB` |
| fitness | `#EF4444` | `rgba(239, 68, 68, 0.12)` | `#FEF2F2` |
| education | `#8B5CF6` | `rgba(139, 92, 246, 0.12)` | `#F5F3FF` |
| podcast | `#EC4899` | `rgba(236, 72, 153, 0.12)` | `#FDF2F8` |
| gaming | `#6366F1` | `rgba(99, 102, 241, 0.12)` | `#EEF2FF` |
| diy | `#D97706` | `rgba(217, 119, 6, 0.12)` | `#FFFBEB` |
| standard | `#6B7280` | `rgba(107, 114, 128, 0.12)` | `#F9FAFB` |

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

Surface colors become translucent in dark mode (`rgba(accent, 0.08)`), maintaining contrast.

---

## Spacing System

Tailwind's default spacing scale (4px base):

| Class | Value | Pixels | Use Case |
|-------|-------|--------|----------|
| `1` | `0.25rem` | 4px | Icon gaps |
| `2` | `0.5rem` | 8px | Tight spacing |
| `3` | `0.75rem` | 12px | |
| `4` | `1rem` | 16px | Default padding |
| `5` | `1.25rem` | 20px | |
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
| `text-xs` | 12px | 16px | Captions, badges |
| `text-sm` | 14px | 20px | Secondary text |
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
| `font-semibold` | 600 | Headings |
| `font-bold` | 700 | Strong emphasis |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `0.625rem` | Default (10px) |
| `rounded-sm` | `calc(var(--radius) - 4px)` | Small elements |
| `rounded-md` | `calc(var(--radius) - 2px)` | Medium |
| `rounded-lg` | `var(--radius)` | Cards, buttons |
| `rounded-xl` | `calc(var(--radius) + 4px)` | Large cards |
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
  --category-accent-soft: rgba(168, 85, 247, 0.12);
  --category-surface: #FAF5FF;
}
```

2. Add dark mode variant:
```css
.dark .category-music {
  --category-surface: rgba(168, 85, 247, 0.08);
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
```
