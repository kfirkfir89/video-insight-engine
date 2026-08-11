# Design Tokens

Color, spacing, and typography tokens for vie-web. Core tokens are defined in `apps/web/src/index.css`; themed/effect layers are split into `apps/web/src/styles/` (`categories.css`, `dark-effects.css`, `animations.css`, `transitions.css`, `overdrive.css`, `flow-grid.css`, `landing.css`) and `@import`ed from index.css.

<rules>
- ALWAYS use semantic tokens (`bg-primary`, `text-muted-foreground`) over palette colors (breaks theming and dark mode)
- ALWAYS define new colors in OKLCH format in `:root` + `.dark` + `@theme inline {}` (inconsistent theming if skipped)
- ALWAYS use Tailwind's 4px-base spacing scale (4, 8, 12, 16, 20, 24, 32, 48px) (visual inconsistency if arbitrary values used)
- ALWAYS add `stagger-children` to list containers with >3 items (misses entrance animation)
- NEVER use `tailwind.config.js` — Tailwind v4 is CSS-first via `@theme inline {}` (config file is ignored)
- NEVER hardcode hex/rgb colors in components (dark mode and theming will break)
- NEVER use `text-muted-foreground` for callout icons — match the callout's `accentColor` (looks visually broken)
</rules>

---

## Configuration

Tailwind v4 uses CSS-first config. No `tailwind.config.js`. Structure in `apps/web/src/index.css`:

```
:root { }             -- Light mode variables
.dark { }             -- Dark mode variables
@theme inline { }     -- Tailwind theme integration
.category-* { }       -- Category accent colors
@layer components { } -- Premium CSS utilities
```

Colors use OKLCH: `oklch(lightness% chroma hue)` — perceptually uniform, intuitive dark mode adjustments (increase L), better color scales.

---

## Core Semantic Colors

| Token                | Light OKLCH       | Dark OKLCH      | Purpose              |
| -------------------- | ----------------- | --------------- | -------------------- |
| `--background`       | `98.5% 0.006 285` | `12% 0.03 280`  | Page bg              |
| `--foreground`       | `16% 0.03 280`    | `94% 0.008 285` | Primary text         |
| `--primary`          | `58% 0.24 292`    | `68% 0.26 292`  | Violet-indigo CTAs   |
| `--secondary`        | `94% 0.012 290`   | `22% 0.025 280` | Secondary buttons    |
| `--muted`            | `95% 0.008 285`   | `20% 0.02 280`  | Muted backgrounds    |
| `--muted-foreground` | `45% 0.025 280`   | `65% 0.015 280` | Muted text           |
| `--accent`           | `95% 0.02 310`    | `22% 0.03 310`  | Hover states         |
| `--destructive`      | `55% 0.22 18`     | `65% 0.22 18`   | Error/delete         |
| `--border`           | `89% 0.012 285`   | `25% 0.02 280`  | Borders              |
| `--ring`             | `58% 0.24 292`    | `68% 0.26 292`  | Focus rings          |
| `--radius`           | `0.75rem`         | same            | Border radius (12px) |

Card, popover, input tokens follow the same pattern — see `index.css` for full values.

---

## Status & Feedback Colors

**Status** (process states):

| Status     | Token                    | Usage                               |
| ---------- | ------------------------ | ----------------------------------- |
| Pending    | `text-status-pending`    | `oklch(79.5% 0.18 86)` / `82%` dark |
| Processing | `text-status-processing` | `oklch(62% 0.21 250)` / `68%` dark  |
| Success    | `text-status-success`    | `oklch(60% 0.15 155)` / `65%` dark  |
| Error      | `text-status-error`      | Uses `--destructive`                |

**Feedback** (callouts, badges, validation):

| Semantic | Tokens                            | Usage                        |
| -------- | --------------------------------- | ---------------------------- |
| Success  | `text-success`, `bg-success-soft` | Positive feedback, pro items |
| Warning  | `text-warning`, `bg-warning-soft` | Caution, tips                |
| Info     | `text-info`, `bg-info-soft`       | Informational notes          |

Each has `-foreground` and `-soft` variants for text-on-color and soft backgrounds.

---

## Category Accent Colors

Apply `.category-*` class to container, access via CSS variables in children:

| Category | Accent    | Category  | Accent    |
| -------- | --------- | --------- | --------- |
| cooking  | `#FF6B35` | coding    | `#22D3EE` |
| travel   | `#10B981` | reviews   | `#F59E0B` |
| fitness  | `#EF4444` | education | `#8B5CF6` |
| podcast  | `#EC4899` | gaming    | `#6366F1` |
| diy      | `#D97706` | standard  | `#6B7280` |

```tsx
<article className={`category-${persona.toLowerCase()}`}>
  <span className="text-[var(--category-accent)]">Accent text</span>
  <div style={{ backgroundColor: "var(--category-accent-soft)" }}>Soft bg</div>
</article>
```

Dark mode surfaces become translucent (`rgba(accent, 0.04)`) automatically.

---

## Premium CSS Utilities

Defined in `@layer components` in `index.css`. Apply these consistently across block components:

**Surfaces**: `block-card` (rounded-xl, shadow, hover lift), `block-accent` (left-border accent), `block-code-container` (dark IDE), `block-inline` (no border, compact).

**Animation**: `stagger-children` (cascading entrance on parent, up to 15 children), `hover-lift` (translateY -2px), `hover-scale` (1.02x hover, 0.98x active), `block-entrance` (single element entrance).

**Effects**: `glass-surface` (backdrop-blur, translucent bg), `text-gradient-primary` (brand gradient text), `text-gradient-warm` (gold/amber for ratings), `fade-divider` / `fade-divider-vertical` (gradient separators), `glow-success` (green glow).

**Dark mode glows** (via `:is(.dark)`): `badge-glow-success`, `badge-glow-warning`, `badge-glow-destructive`, `amount-badge-glow`, `timer-glow`, `day-number-glow`, `avatar-glow`. Also auto-applied to `block-card:hover`, `timeline-line`, `text-gradient-*`, etc.

**Block-specific**: `pro-con-bar`, `timeline-line`/`-animated`, `timeline-dot`, `definition-item`, `numbered-ghost`, `step-connector`, `location-map-bg`, `quote-decorative-mark`, `code-traffic-light`, `callout-gradient-*` (tip/warning/note/security).

---

## Spacing, Typography, Border

**Spacing** (4px base): `1`=4px (icon gaps), `2`=8px (tight), `4`=16px (default padding), `5`=20px (card padding), `6`=24px (sections), `8`=32px, `12`=48px (page sections).

**Typography**: `text-xs`=12px (captions, block headers), `text-sm`=14px (secondary, block body), `text-base`=16px (body), `text-lg`-`text-4xl` for headings. Weights: `font-normal`(400), `font-medium`(500), `font-semibold`(600 headings), `font-bold`(700).

**Border radius**: `rounded-sm` (-4px), `rounded-md` (-2px), `rounded-lg` (base 12px), `rounded-xl` (+4px, block cards), `rounded-full` (pills).

**Border width**: `--border-width: 1px`. Use `calc(var(--border-width) * N)` for multiples.

---

## Adding New Tokens

To add a semantic color: 1) Define in `:root` with OKLCH value, 2) Add `.dark` variant with higher lightness, 3) Register in `@theme inline { --color-name: var(--name); }`, 4) Use as `text-name` / `bg-name` in components.

To add a category: Add `.category-name` with `--category-accent`, `--category-accent-soft`, `--category-surface`, plus `.dark .category-name` variant.

---

## Edge Cases

- **One-off spacing**: If a design truly needs non-scale spacing (e.g., `w-[137px]`), use arbitrary values only when it is a fixed external constraint (image size, API dimension). Document why.
- **Dark mode opacity**: Use higher opacity in dark mode (`bg-primary/10 dark:bg-primary/20`) for equivalent visual weight.
- **New token threshold**: Create a new token only when the value represents a semantic concept, is used in 3+ places, and needs dark mode adaptation. One-off values do not warrant tokens.

---

## Rules Summary

All tokens live in `index.css` using OKLCH format with `:root` (light), `.dark` (dark), and `@theme inline` (Tailwind registration) — never use `tailwind.config.js`. Use semantic tokens (`bg-primary`, `text-muted-foreground`) for all colors; hardcoded hex/rgb values break theming. Stick to the 4px-base spacing scale and standard typography sizes. Category theming applies `.category-*` on containers and reads `--category-accent` variables in children. Premium utilities (`stagger-children`, `hover-lift`, `glass-surface`, `text-gradient-*`, `fade-divider`, dark mode `*-glow` classes) must be applied consistently in block components. New tokens require OKLCH values in both modes plus `@theme inline` registration.
