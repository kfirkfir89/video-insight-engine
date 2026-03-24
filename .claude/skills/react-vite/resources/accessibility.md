# Accessibility (React)

ARIA, keyboard navigation, screen readers, reduced motion, and inclusive design.

<rules>
- ALWAYS use semantic HTML elements (header, nav, main, footer, article, section) — never div soup (causes screen readers to miss page structure)
- ALWAYS add `aria-label` to icon-only buttons and interactive elements without visible text (causes unlabeled controls for screen readers)
- ALWAYS trap focus inside modals and restore focus on close (causes focus escape to hidden content behind modal)
- ALWAYS provide visible focus indicators — never `outline: none` without a replacement (causes keyboard users to lose track of focus)
- ALWAYS wrap animations in `prefers-reduced-motion` — default to no motion, opt in when user allows (causes vestibular issues for sensitive users)
- NEVER rely on color alone to convey meaning — use icons, text, or patterns alongside (causes information loss for color-blind users)
- NEVER remove focus outlines without providing an alternative focus style (causes WCAG 2.1 AA violation)
</rules>

---

## Semantic HTML

ALWAYS use `<header>`, `<nav>`, `<main>`, `<footer>`, `<article>`. Add `aria-label` to nav elements when multiple navs exist. Include a skip-to-content link.

```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4"
>
  Skip to main content
</a>
```

---

## ARIA Labels

Use `aria-label` when no visible text exists. Use `aria-labelledby` to reference visible text. Use `aria-describedby` for supplementary hints. Use `aria-live="polite"` for dynamic content announcements.

```tsx
<button aria-label="Delete item" onClick={handleDelete}>
  <TrashIcon aria-hidden="true" />
</button>

<div role="status" aria-live="polite" className="sr-only">{statusMessage}</div>
```

---

## Keyboard Navigation

ALWAYS support: Tab (next), Shift+Tab (previous), Enter/Space (activate), Escape (close), Arrow keys (navigate within widgets).

Modal focus trap: save previous focus, focus modal on open, trap Tab cycling, restore focus on close.

Roving tabindex for menus/lists: active item gets `tabIndex={0}`, others get `tabIndex={-1}`. Move active index with arrow keys.

---

## Form Accessibility

ALWAYS pair labels with inputs via `htmlFor`/`id`. Mark required fields with `aria-required`. Link errors with `aria-describedby`. Show error summary with `role="alert"`.

```tsx
<label htmlFor="email">Email <span aria-hidden="true">*</span></label>
<input id="email" aria-required="true" aria-invalid={!!error} aria-describedby={error ? 'email-error' : undefined} />
{error && <p id="email-error" role="alert">{error}</p>}
```

---

## Focus Indicators

ALWAYS provide visible focus styles. Use `focus-visible:` for keyboard-only indicators.

```tsx
<button className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
  Action
</button>
```

---

## Reduced Motion

ALWAYS default to no animation. Add motion only inside `prefers-reduced-motion: no-preference`. Use Tailwind's `motion-safe:` / `motion-reduce:` variants.

```tsx
<div className="motion-safe:animate-bounce motion-reduce:animate-none">
  Content
</div>
```

Short opacity/transform transitions (<200ms) are generally acceptable even with reduced motion.

---

## Images and Media

Informative images: descriptive `alt` text. Decorative images: `alt=""` with `role="presentation"`. Complex charts: use `aria-describedby` with a text description. Videos: always include captions track.

---

## Testing Accessibility

Use jest-axe for automated violation detection. Test keyboard navigation with `userEvent.tab()` and `userEvent.keyboard('{Escape}')`. Verify screen reader text with `getByRole` queries.

---

## Edge Cases

- **Color contrast:** Minimum 4.5:1 for normal text, 3:1 for large text (WCAG AA). Status indicators must use icons/text alongside color.
- **Touch targets:** Minimum 44x44px on interactive elements. Achieve with padding on the button, not by enlarging content.
- **Autoplay content:** Never autoplay video or animated content without checking `prefers-reduced-motion`. Provide pause controls.

---

## Rules Summary

Use semantic HTML elements for page structure, aria-label for icon-only controls, and aria-live for dynamic announcements. Modals trap focus and restore it on close. Every interactive element has a visible focus indicator (focus-visible ring). Forms link labels, errors, and hints with htmlFor and aria-describedby. Animations default to off and opt in via prefers-reduced-motion: no-preference. Color never conveys meaning alone. Touch targets are 44px minimum. Test with jest-axe and keyboard-only navigation.
