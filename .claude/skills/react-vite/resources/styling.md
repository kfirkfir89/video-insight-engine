# Web Styling Principles

Generic CSS architecture, design tokens, responsive design, and styling patterns.

<rules>
- ALWAYS use design tokens (CSS variables) for colors, spacing, typography — never hardcoded values (causes inconsistency and painful theme changes)
- ALWAYS use a consistent spacing scale based on 4px increments (causes visual rhythm breakdown with arbitrary values)
- ALWAYS use semantic color names (--color-primary, --color-error) over palette names (--blue-500) (causes confusion when brand colors change)
- ALWAYS use mobile-first responsive design — base styles for mobile, min-width breakpoints for larger (causes desktop-first regressions)
- ALWAYS use logical properties (margin-inline, padding-block) over physical (margin-left, padding-top) (causes RTL layout bugs)
- NEVER animate layout properties (width, height, margin, left) — only `transform` and `opacity` are GPU-accelerated (causes layout thrashing and jank)
- NEVER use arbitrary z-index values — define a scale (dropdown: 100, sticky: 200, modal: 400, toast: 500) (causes z-index arms race)
</rules>

---

## Design Tokens

ALWAYS define centrally. Every design decision in ONE place.

```css
:root {
  --space-1: 0.25rem; /* 4px */
  --space-2: 0.5rem; /* 8px */
  --space-4: 1rem; /* 16px */
  --space-8: 2rem; /* 32px */

  --color-text: #1a1a1a;
  --color-text-muted: #6b7280;
  --color-primary: #3b82f6;
  --color-error: #ef4444;
  --color-success: #22c55e;
}
```

---

## Spacing System

ALWAYS use 4px grid. All spacing values must be multiples of 4. Common scale: 4, 8, 16, 24, 32, 48px.

---

## Color System

Use semantic colors that map to palette colors. Components reference `var(--color-primary)`, never raw hex values. For dark mode, redefine variables under `.dark` selector.

Accessibility: minimum 4.5:1 contrast ratio for text, 3:1 for large text. Never rely on color alone — use icons/text alongside.

---

## Typography

Use a type scale with consistent ratio. Pair sizes with line heights: tighter for headings (1.2), looser for body (1.6). Use `clamp()` for fluid typography that scales between viewport sizes without breakpoints.

```css
h1 {
  font-size: clamp(1.75rem, 4vw, 3rem);
}
body {
  font-size: clamp(1rem, 1.5vw, 1.125rem);
}
```

---

## Responsive Design

ALWAYS mobile-first. Use `min-width` media queries. Test at 320, 375, 768, 1024, 1440px. Use container queries (`@container`) when component layout depends on its own size, not viewport.

---

## Animation

ONLY animate `transform` and `opacity`. Duration guidelines: instant feedback 100-150ms, transitions 200-300ms, page transitions 300-500ms. ALWAYS respect `prefers-reduced-motion`.

---

## Z-Index Scale

```css
:root {
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-overlay: 300;
  --z-modal: 400;
  --z-toast: 500;
}
```

---

## Logical Properties

ALWAYS use logical properties for internationalization support.

| Physical         | Logical             | Tailwind   |
| ---------------- | ------------------- | ---------- |
| margin-left      | margin-inline-start | ms-\*      |
| padding-right    | padding-inline-end  | pe-\*      |
| left             | inset-inline-start  | start-\*   |
| text-align: left | text-align: start   | text-start |

---

## Edge Cases

- **Container queries vs media queries:** Use `@media` for page-level layout, `@container` for component-level adaptation. Container queries make components reusable across different layout contexts.
- **CSS-in-JS:** Avoid in this project. Use Tailwind utilities or CSS Modules for any edge case Tailwind can't handle.
- **Inline styles:** Only for truly dynamic runtime values (computed positions, percentages from data). Everything else goes through Tailwind or CSS variables.

---

## Rules Summary

Design tokens (CSS variables) are the single source of truth for all visual values — colors, spacing, typography, shadows, z-index. Spacing follows a 4px grid, colors use semantic names, and typography uses clamp() for fluid scaling. Responsive design is mobile-first with min-width breakpoints and container queries for component-level adaptation. Only transform and opacity are animated, always with prefers-reduced-motion respect. Logical properties replace physical directions for RTL support. Z-index follows a defined scale from 100 (dropdown) to 500 (toast).
