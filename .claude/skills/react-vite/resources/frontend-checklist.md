# Frontend Production Checklist

Pre-ship verification for layout stability, assets, responsiveness, CSS quality, and error resilience.

<rules>
- ALWAYS set explicit dimensions on images/videos/embeds — width/height, aspect-ratio, or min-height (causes CLS on load)
- ALWAYS use transform for panel animations — never animate width, height, or toggle display:none (causes layout shift and jank)
- ALWAYS wrap all animations in prefers-reduced-motion check (causes accessibility violation for motion-sensitive users)
- ALWAYS define a z-index scale with CSS variables — never arbitrary values (causes z-index arms race)
- ALWAYS use logical CSS properties (margin-inline, padding-block) over physical (causes RTL layout bugs)
- NEVER ship without error boundaries around every major section (causes full-page crashes from one broken widget)
- NEVER ship async operations without loading, error, AND empty states (causes blank screens)
</rules>

---

## Layout Stability (CLS)

- Every image/video/embed has explicit dimensions or aspect-ratio
- Skeleton placeholders match final content size
- Sidebars/drawers use transform for show/hide
- No forced synchronous layout (no read-after-write in same frame)
- `content-visibility: auto` on off-screen sections
- `will-change` only on actively animating elements

---

## Asset Loading

- Fonts: `font-display: swap`, woff2 only, subset, fallback metrics matched
- Critical assets preloaded: `<link rel="preload">` for above-fold fonts and hero images
- JS main bundle under 100KB gzipped, route-level code splitting
- Scripts use `defer`, not `async`

---

## Responsive Design

- Fluid typography with `clamp()`
- Container queries for component-level responsiveness
- Touch targets minimum 44x44px
- Tested at 320px, 375px, 768px, 1024px, 1440px
- `dvh` instead of `vh` on mobile

---

## CSS Architecture

- Z-index scale defined (dropdown:100, sticky:200, modal:400, toast:500)
- Logical properties used (margin-inline, padding-block, text-align: start)
- No `!important` except utility overrides
- All animations wrapped in prefers-reduced-motion

---

## Error Resilience

- Error boundaries around every major section
- Every async operation has loading, error, and empty states
- Search inputs and resize/scroll handlers debounced

---

## Quick Scan

```
Layout stable?     → No shifts on load, transform-only animations
Assets optimized?  → Fonts subset, images sized, JS budget met
Responsive?        → Fluid type, touch targets, tested 320-1440px
CSS clean?         → Z-index scale, logical props, no !important
Motion safe?       → prefers-reduced-motion respected
Error resilient?   → Boundaries, loading/error/empty states, debounced handlers
```

---

## Rules Summary

Before shipping: every media element has explicit dimensions, panels animate with transform only, skeletons match final size, fonts are subset woff2 with swap, JS stays under 100KB gzipped with route splitting. Responsive design uses clamp() for fluid type, 44px touch targets, and is tested at 5 breakpoints. Z-index follows a defined scale, logical properties replace physical for RTL, and animations respect reduced-motion. Every section has an error boundary, every async path has three states (loading, error, empty), and expensive handlers are debounced.
