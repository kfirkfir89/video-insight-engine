# Web Styling Principles

Generic CSS architecture and design principles for modern web applications.

---

## Core Philosophy

### Separation of Concerns

**Structure (HTML) vs Presentation (CSS) vs Behavior (JS)**

```
DO ✅                              DON'T ❌
─────────────────────             ─────────────────────
• Semantic HTML elements          • Divs for everything
• CSS handles all visual styling  • Inline styles everywhere
• JS for interactivity only       • JS manipulating styles directly
```

### Single Source of Truth

Every design decision should be defined in ONE place.

```
DO ✅                              DON'T ❌
─────────────────────             ─────────────────────
• Design tokens in config         • Magic numbers everywhere
• Variables for colors            • Hardcoded hex values
• Consistent spacing scale        • Random padding values
```

---

## Design Token Architecture

### Why Design Tokens?

Design tokens are the **single source of truth** for your design system.

```
┌─────────────────────────────────────────────────┐
│              Design Tokens                       │
│  (colors, spacing, typography, shadows, etc.)   │
└─────────────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   ┌─────────┐   ┌─────────┐   ┌─────────┐
   │   CSS   │   │  React  │   │  Native │
   │Variables│   │  Theme  │   │   App   │
   └─────────┘   └─────────┘   └─────────┘
```

### Token Categories

| Category        | Examples                     | Why                  |
| --------------- | ---------------------------- | -------------------- |
| **Colors**      | Primary, secondary, semantic | Brand consistency    |
| **Spacing**     | 4px, 8px, 16px scale         | Visual rhythm        |
| **Typography**  | Font sizes, line heights     | Readability          |
| **Shadows**     | Elevation levels             | Depth perception     |
| **Borders**     | Radius, widths               | Component definition |
| **Breakpoints** | Mobile, tablet, desktop      | Responsive design    |

### DO ✅

```css
/* Define tokens centrally */
:root {
  /* Spacing scale (4px base) */
  --space-1: 0.25rem; /* 4px */
  --space-2: 0.5rem; /* 8px */
  --space-4: 1rem; /* 16px */
  --space-6: 1.5rem; /* 24px */
  --space-8: 2rem; /* 32px */

  /* Semantic colors */
  --color-text: #1a1a1a;
  --color-text-muted: #6b7280;
  --color-background: #ffffff;
  --color-primary: #3b82f6;
  --color-error: #ef4444;
  --color-success: #22c55e;
}

/* Use tokens everywhere */
.card {
  padding: var(--space-6);
  color: var(--color-text);
  background: var(--color-background);
}
```

### DON'T ❌

```css
/* Magic numbers and hardcoded values */
.card {
  padding: 23px; /* Why 23? */
  color: #374151; /* What color is this? */
  background: white; /* Won't adapt to dark mode */
}

.button {
  padding: 11px 17px; /* Different from card */
  color: #2563eb; /* Slightly different blue? */
}
```

---

## Spacing System

### The 4px Grid

Most design systems use a **4px base unit**. All spacing should be multiples of 4.

```
4px  → Tight (icon gaps)
8px  → Small (related items)
16px → Medium (default padding)
24px → Large (section spacing)
32px → XL (major sections)
48px → 2XL (page sections)
```

### DO ✅

```css
/* Consistent scale */
.compact {
  gap: 0.5rem;
} /* 8px */
.normal {
  gap: 1rem;
} /* 16px */
.relaxed {
  gap: 1.5rem;
} /* 24px */
```

### DON'T ❌

```css
/* Random values */
.section-a {
  padding: 17px;
}
.section-b {
  padding: 22px;
}
.section-c {
  margin: 13px;
}
```

---

## Color System

### Semantic vs Palette Colors

```
Palette Colors              Semantic Colors
(raw values)               (purpose-based)
─────────────              ─────────────
blue-500                   → primary
red-500                    → error / destructive
green-500                  → success
gray-500                   → muted
```

### DO ✅

```css
/* Use semantic colors */
.button-primary {
  background: var(--color-primary);
}

.error-message {
  color: var(--color-error);
}

.success-badge {
  background: var(--color-success);
}
```

### DON'T ❌

```css
/* Hardcoded palette colors */
.button {
  background: #3b82f6; /* What if brand color changes? */
}

.error {
  color: red; /* Too bright, not accessible */
}
```

### Color Accessibility

- **Contrast ratio:** Minimum 4.5:1 for normal text, 3:1 for large text
- **Don't rely on color alone:** Use icons, patterns, or text as well
- **Test with color blindness simulators**

---

## Typography

### Type Scale

Use a consistent scale based on a ratio (1.25 is common):

```
12px  → Caption
14px  → Small / Secondary
16px  → Body (base)
20px  → Large / Lead
24px  → H4
32px  → H3
40px  → H2
48px  → H1
```

### DO ✅

```css
/* Define type scale */
:root {
  --text-xs: 0.75rem; /* 12px */
  --text-sm: 0.875rem; /* 14px */
  --text-base: 1rem; /* 16px */
  --text-lg: 1.25rem; /* 20px */
  --text-xl: 1.5rem; /* 24px */
  --text-2xl: 2rem; /* 32px */
}

/* Pair with line heights */
h1 {
  font-size: var(--text-2xl);
  line-height: 1.2; /* Tighter for headings */
}

p {
  font-size: var(--text-base);
  line-height: 1.6; /* Looser for body */
}
```

### DON'T ❌

```css
/* Random sizes */
.title {
  font-size: 27px;
}
.subtitle {
  font-size: 19px;
}
.body {
  font-size: 15px;
}
```

---

## Responsive Design

### Mobile-First Approach

Start with mobile styles, add complexity for larger screens.

```
Mobile (default)  →  Tablet (md)  →  Desktop (lg)
     ↓                   ↓              ↓
  Stack layout      Side-by-side    Multi-column
  Full-width        Fixed sidebar   Spacious
  Touch targets     Hover states    Dense info
```

### DO ✅

```css
/* Mobile first */
.container {
  display: flex;
  flex-direction: column; /* Stack on mobile */
  gap: 1rem;
}

@media (min-width: 768px) {
  .container {
    flex-direction: row; /* Side by side on tablet+ */
    gap: 2rem;
  }
}
```

### DON'T ❌

```css
/* Desktop first (harder to maintain) */
.container {
  display: grid;
  grid-template-columns: 250px 1fr 300px;
}

@media (max-width: 1024px) {
  .container {
    grid-template-columns: 200px 1fr;
  }
}

@media (max-width: 768px) {
  .container {
    grid-template-columns: 1fr;
  }
}
```

### Breakpoint Guidelines

| Breakpoint  | Target       | Considerations                  |
| ----------- | ------------ | ------------------------------- |
| < 640px     | Phones       | Touch, single column            |
| 640-768px   | Large phones | Touch, possible 2 col           |
| 768-1024px  | Tablets      | Touch + mouse, sidebar possible |
| 1024-1280px | Laptops      | Mouse, multi-column             |
| > 1280px    | Desktops     | Full layout, hover states       |

---

## Component Styling Patterns

### Utility-First vs Component Classes

```
Utility-First                    Component Classes
─────────────                    ─────────────────
"p-4 bg-white rounded shadow"    ".card"
Pros: Fast, no naming            Pros: Semantic, reusable
Cons: Verbose HTML               Cons: CSS bloat, naming hard
```

### When to Use What

| Pattern           | When to Use                           |
| ----------------- | ------------------------------------- |
| Utility classes   | One-off styling, rapid prototyping    |
| Component classes | Reusable patterns, complex components |
| CSS Modules       | Scoped styles, third-party isolation  |
| CSS-in-JS         | Dynamic styles, theme-dependent       |

---

## Animation Best Practices

### Performance

**Only animate these properties (GPU accelerated):**

- `transform` (translate, scale, rotate)
- `opacity`

### DO ✅

```css
/* GPU-accelerated properties */
.card {
  transition: transform 0.2s, opacity 0.2s;
}

.card:hover {
  transform: translateY(-4px);
  opacity: 0.95;
}
```

### DON'T ❌

```css
/* Causes layout thrashing */
.card:hover {
  margin-top: -4px; /* Triggers layout */
  width: 102%; /* Triggers layout */
  height: auto; /* Triggers layout */
  left: 10px; /* Use transform instead */
}
```

### Animation Principles

| Principle         | Duration  | Use Case              |
| ----------------- | --------- | --------------------- |
| Instant feedback  | 100-150ms | Button press, hover   |
| Quick transitions | 200-300ms | Dropdowns, modals     |
| Noticeable motion | 300-500ms | Page transitions      |
| Deliberate        | 500ms+    | Onboarding, attention |

---

## Dark Mode Architecture

### CSS Variables Strategy

```css
:root {
  --bg: #ffffff;
  --text: #1a1a1a;
  --border: #e5e7eb;
}

.dark {
  --bg: #1a1a1a;
  --text: #f3f4f6;
  --border: #374151;
}

/* Components just use variables */
.card {
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
}
```

### DO ✅

```css
/* Single class reference */
.card {
  background: var(--color-card);
  /* Automatically adapts to theme */
}
```

### DON'T ❌

```css
/* Duplicating everything */
.card {
  background: white;
}

.dark .card {
  background: #1f2937;
}
```

---

## CSS Architecture

### File Organization

```
styles/
├── tokens/
│   ├── colors.css
│   ├── spacing.css
│   └── typography.css
├── base/
│   ├── reset.css
│   └── globals.css
├── components/
│   ├── button.css
│   └── card.css
└── index.css (imports all)
```

### Naming Conventions

| Convention | Example               | Use Case            |
| ---------- | --------------------- | ------------------- |
| BEM        | `.card__title--large` | Traditional CSS     |
| Utility    | `.p-4 .bg-white`      | Tailwind-style      |
| Semantic   | `.primary-button`     | Component libraries |

---

## Quick Decision Guide

### Should I create a new CSS class?

- [ ] Will it be used 3+ times? → YES
- [ ] Is it just one property? → NO (use utility)
- [ ] Does it have complex state? → YES
- [ ] Is it a unique one-off? → NO (use inline/utility)

### Should I use a design token?

- [ ] Will this value be reused? → YES
- [ ] Could it change with theming? → YES
- [ ] Is it a magic number? → YES, make it a token
- [ ] Is it truly unique? → Maybe inline is OK

---

## Fluid Typography & Spacing

### `clamp()` for Responsive Values

Use `clamp()` instead of fixed breakpoints for typography and spacing that scales smoothly.

```css
/* Fluid font sizes — no breakpoints needed */
h1 { font-size: clamp(1.75rem, 4vw, 3rem); }
h2 { font-size: clamp(1.5rem, 3vw, 2.25rem); }
body { font-size: clamp(1rem, 1.5vw, 1.125rem); }

/* Fluid spacing */
.section { padding: clamp(1rem, 3vw, 3rem); }
.container { gap: clamp(0.75rem, 2vw, 2rem); }
```

### How `clamp()` Works

```
clamp(minimum, preferred, maximum)
       │          │         │
       │          │         └── Never larger than this
       │          └──────────── Scales with viewport
       └─────────────────────── Never smaller than this
```

### `min()` and `max()` for Layout

```css
/* Container that's responsive but capped */
.container {
  width: min(90vw, 1200px);    /* 90% of viewport, max 1200px */
  margin-inline: auto;
}

/* Sidebar that shrinks on small screens */
.sidebar {
  width: max(200px, 25vw);     /* At least 200px, grows to 25vw */
}
```

---

## Container Queries

Use `@container` when a component's layout depends on its own size, not the viewport. This makes components truly reusable — they adapt to wherever they're placed.

### DO ✅

```css
/* Define a containment context */
.card-container {
  container-type: inline-size;
  container-name: card;
}

/* Component responds to its container, not viewport */
@container card (min-width: 400px) {
  .card-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}

@container card (max-width: 399px) {
  .card-content {
    display: flex;
    flex-direction: column;
  }
}
```

### When to Use

| Layout depends on... | Use |
|---|---|
| Viewport width | `@media` queries |
| Parent/container width | `@container` queries |
| Both | `@media` for page layout, `@container` for component internals |

---

## Z-Index Scale

Define a z-index system. Never use arbitrary values.

### DO ✅

```css
:root {
  --z-base: 0;
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-overlay: 300;
  --z-modal: 400;
  --z-toast: 500;
}

.dropdown { z-index: var(--z-dropdown); }
.sticky-header { z-index: var(--z-sticky); }
.modal-backdrop { z-index: var(--z-overlay); }
.modal { z-index: var(--z-modal); }
.toast { z-index: var(--z-toast); }
```

### DON'T ❌

```css
.dropdown { z-index: 10; }
.modal { z-index: 9999; }     /* Arms race begins */
.toast { z-index: 99999; }    /* Madness */
.tooltip { z-index: 999999; } /* Nuclear option */
```

---

## Logical Properties

Use logical properties instead of physical directions for internationalization support (RTL languages).

### DO ✅

```css
/* Logical — works in LTR and RTL */
.card {
  margin-inline: auto;           /* horizontal margin */
  padding-block: 1rem;           /* vertical padding */
  padding-inline: 1.5rem;        /* horizontal padding */
  border-inline-start: 3px solid var(--accent);  /* "left" in LTR, "right" in RTL */
  text-align: start;             /* left in LTR, right in RTL */
}

.icon {
  margin-inline-end: 0.5rem;     /* Spacing after icon, direction-aware */
}
```

### Physical → Logical Mapping

| Physical | Logical | Tailwind |
|----------|---------|----------|
| `margin-left` / `margin-right` | `margin-inline-start` / `margin-inline-end` | `ms-*` / `me-*` |
| `padding-left` / `padding-right` | `padding-inline-start` / `padding-inline-end` | `ps-*` / `pe-*` |
| `margin-top` / `margin-bottom` | `margin-block-start` / `margin-block-end` | — |
| `left` / `right` | `inset-inline-start` / `inset-inline-end` | `start-*` / `end-*` |
| `text-align: left` | `text-align: start` | `text-start` |
| `border-left` | `border-inline-start` | `border-s-*` |

---

## Touch Target Sizing

All interactive elements must meet minimum touch target size on mobile.

### Rules

- **Minimum 44x44px** hit area for all buttons, links, inputs on touch devices
- Use `min-height` and `min-width` or padding to meet the target
- Spacing between targets should be at least 8px

### DO ✅

```css
/* Ensure touch targets meet minimum size */
button, a, input, select {
  min-height: 44px;
  min-width: 44px;
}

/* Small visual button with adequate hit area */
.icon-button {
  width: 32px;
  height: 32px;
  padding: 6px;               /* Visual size: 32px */
  /* Hit area extended by negative margin + padding trick or touch-action */
}
```

### DON'T ❌

```css
/* Tiny tappable element — frustrating on mobile */
.small-link {
  font-size: 12px;
  padding: 2px 4px;           /* Total: ~20x16px — way too small */
}
```

## Resources

For framework-specific implementation:

- **Frontend Guide:** See [docs/FRONTEND.md](../../../docs/FRONTEND.md) - Tailwind CSS, components, state management
