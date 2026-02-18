# Frontend Production Checklist

Pre-flight checklist for production-ready frontend code. These rules fill gaps not covered by other resource files — check them alongside `performance.md`, `accessibility.md`, `styling.md`, and `react.md`.

---

## Layout Stability (CLS Prevention)

- [ ] **Every image/video/embed has explicit dimensions** — `width`/`height` attributes, `aspect-ratio`, or `min-height`
- [ ] **Skeleton placeholders match final content size** — no layout jump when real content loads
- [ ] **Sidebars/drawers/panels use `transform` for show/hide** — never animate `width`, `height`, or toggle `display: none`
- [ ] **No forced synchronous layout** — never read `offsetHeight`, `getBoundingClientRect()` immediately after writing styles in the same frame
- [ ] **`content-visibility: auto`** on off-screen sections (long lists, below-fold content)
- [ ] **`will-change` used sparingly** — only on elements that actually animate, removed after animation completes

---

## Asset Loading

- [ ] **Fonts optimized** — `font-display: swap`, `woff2` only, subset when possible
- [ ] **Font fallback metrics matched** — `size-adjust`, `ascent-override`, `descent-override` on fallback `@font-face` to prevent layout shift during swap
- [ ] **Critical assets preloaded** — `<link rel="preload">` for above-the-fold fonts, hero images, critical CSS
- [ ] **JS bundle budget** — main bundle under 100KB gzipped, route-level code splitting for the rest
- [ ] **Scripts use `defer`** — not `async` unless load order doesn't matter

---

## Responsive Design

- [ ] **Fluid typography with `clamp()`** — `font-size: clamp(1rem, 2.5vw, 1.5rem)` instead of fixed breakpoints alone
- [ ] **Container queries for component-level responsiveness** — `@container` when layout depends on component size, not viewport
- [ ] **Touch targets minimum 44x44px** on all interactive elements for mobile
- [ ] **Tested at real breakpoints** — 320px, 375px, 768px, 1024px, 1440px
- [ ] **Viewport units use `dvh`** — `dvh` instead of `vh` on mobile to account for browser chrome

---

## CSS Architecture

- [ ] **Z-index scale defined** — `--z-dropdown: 100`, `--z-sticky: 200`, `--z-modal: 300`, `--z-toast: 400`. Never arbitrary values like `9999`
- [ ] **Logical properties used** — `margin-inline`, `padding-block`, `inset-inline-start` over `margin-left`, `padding-top`, `left` for internationalization
- [ ] **No `!important`** except in utility overrides — if needed, specificity hierarchy is broken
- [ ] **All animations wrapped in `prefers-reduced-motion`** — static fallback by default, motion opt-in

---

## Error Resilience

- [ ] **Error boundaries around every major section** — one broken component must not crash the entire page
- [ ] **Every async operation has loading, error, and empty states** — no blank screens
- [ ] **Expensive handlers debounced** — search inputs, resize, scroll handlers

---

## Quick Scan

Run through before shipping any feature:

```
Layout stable?     → No content shifts on load, no layout-triggering animations
Assets optimized?  → Fonts subset, images sized, JS budget met
Responsive?        → Fluid type, touch targets, tested at 320-1440px
CSS clean?         → Z-index scale, logical props, no !important
Motion safe?       → prefers-reduced-motion respected
Error resilient?   → Boundaries, loading states, debounced handlers
```
