---
name: design-system
description: Design system patterns for icons, tokens, and components. Enforces consistency using Tailwind v4, shadcn/ui, lucide-react, and CVA.
version: 1.0.0
updated: 2026-02-05
---

# Design System Guidelines

This skill teaches you to THINK about design consistency, not just copy patterns.

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Tailwind CSS | 4.x | Utility-first styling (CSS-first config) |
| shadcn/ui | latest | Accessible component primitives (new-york style) |
| lucide-react | latest | Icon library (tree-shakeable SVG) |
| CVA | latest | Component variant management |
| OKLCH | - | Perceptually uniform color space |

---

## Design System Mindset

Before writing any styles, ask yourself:

1. **Does a semantic token exist for this?** Don't use `text-gray-500` if `text-muted-foreground` expresses intent.

2. **Is this icon mapped to a concept?** "Delete" = `Trash2`, "Loading" = `Loader2`. Don't reinvent mappings.

3. **Does shadcn/ui have this component?** Check before building. Extend, don't recreate.

4. **Will this need variants?** If yes, use CVA from the start. Adding variants to raw className is painful.

5. **Is the color responsive to theme?** Use CSS variables (`var(--primary)`), not hardcoded hex values.

---

## Core Principles

### Single Source of Truth

Every design decision should be defined in ONE place.

```
Configuration Location
──────────────────────
Tokens & Colors    →  Main CSS file (e.g., index.css or globals.css)
Components         →  UI component directory (e.g., components/ui/)
Icons              →  lucide-react (never custom SVGs)
```

### Semantic Over Palette

Use intent-based tokens, not raw colors.

```tsx
// DO: Semantic meaning
<p className="text-muted-foreground">Secondary text</p>
<span className="text-destructive">Error message</span>
<Icon className="text-status-success" />

// DON'T: Palette colors
<p className="text-gray-500">Secondary text</p>  // What if muted changes?
<span className="text-red-500">Error message</span>  // Not theme-aware
```

### Category Theming

Content types have dedicated color systems:

```tsx
// Apply category class to container
<article className="category-cooking">
  {/* Children access via CSS variables */}
  <span style={{ color: "var(--category-accent)" }}>
    Chef icon color
  </span>
</article>
```

---

## Quick Decision Guides

### Which Icon Should I Use?

1. Check `icons.md` for semantic mappings
2. Search existing usage in your component directory
3. Check lucide.dev for icon names
4. Add to `icons.md` if new concept

### Do I Need a New Token?

**YES if:**
- Value represents a semantic concept (status, category)
- Used in 3+ places
- Needs to adapt to dark mode

**NO if:**
- One-off spacing adjustment
- Already exists (check `index.css` first)
- Can be expressed with existing utilities

### Should I Create a New Component?

**YES if:**
- Needs multiple variants (use CVA)
- Has complex interaction states
- Will be reused across features

**NO if:**
- Just styled HTML element
- Can compose existing shadcn/ui primitives
- Only used once

---

## Resource Files

For implementation details on specific topics:

| Need to... | Read this |
|------------|-----------|
| Choose/use icons correctly | [icons.md](resources/icons.md) |
| Use colors, spacing, category theming | [tokens.md](resources/tokens.md) |
| Build components with CVA, shadcn patterns | [components.md](resources/components.md) |
| Translate Figma designs to code | [figma.md](resources/figma.md) |
| Set up component documentation | [storybook.md](resources/storybook.md) |

---

## Related Skills

This skill complements:

| Skill | When to Use Together |
|-------|---------------------|
| react-vite | Building React components that need design system tokens |
| react-vite/lucide.md | General Lucide + Tailwind patterns (this skill has project mappings) |

---

## Project Documentation

For THIS project's specifics:

| Need | Reference |
|------|-----------|
| Full color values | [apps/web/src/index.css](../../../apps/web/src/index.css) |
| Component inventory | [apps/web/src/components/ui/](../../../apps/web/src/components/ui/) |
| Frontend patterns | [docs/FRONTEND.md](../../../docs/FRONTEND.md) |
