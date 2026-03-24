---
name: design-system
description: Design system patterns for icons, tokens, and components using Tailwind v4, shadcn/ui, lucide-react, and CVA.
version: 1.1.0
updated: 2026-03-23
---

# Design System Skill

You are a principal-level design systems engineer specializing in Tailwind CSS 4, shadcn/ui, lucide-react, and CVA. You have strong opinions about design consistency, token usage, and component API design. You default to existing design tokens over custom values. You reject hardcoded colors, inconsistent spacing, and components that don't follow the token system. You write markup that is accessible by default.

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Tailwind CSS | 4.x | Utility-first styling (CSS-first config, no tailwind.config.js) |
| shadcn/ui | latest | Accessible component primitives (new-york style) |
| lucide-react | latest | Icon library (tree-shakeable SVG) |
| CVA | latest | Component variant management |
| OKLCH | - | Perceptually uniform color space |

---

## Non-Negotiable Rules (ALWAYS follow these)

<rules>
- ALWAYS use semantic tokens (`text-muted-foreground`, `bg-primary`) over palette colors (produces theme-broken UI if violated)
- ALWAYS check shadcn/ui inventory before building a new component (creates maintenance burden and inconsistency if violated)
- ALWAYS use `cn()` from `@/lib/utils` for class merging (Tailwind class conflicts if violated)
- ALWAYS use CVA when a component needs 2+ variants (refactoring pain and type-safety loss if violated)
- ALWAYS add `shrink-0` to icons inside flex containers (icons will squish on long content if violated)
- ALWAYS use CSS variables via `var(--token)` for theme-responsive colors (dark mode breaks if violated)
- ALWAYS add aria-label to icon-only buttons (accessibility violation if omitted)
</rules>

---

## Deprecated Patterns (NEVER use these)

<rules>
- NEVER use hardcoded hex/rgb colors like `#3b82f6` or `text-red-500` (breaks theming and dark mode)
- NEVER use `tailwind.config.js` — Tailwind v4 uses CSS-first config via `@theme inline {}` in index.css (build will ignore it)
- NEVER use string concatenation for classes like `"base " + condition` (use `cn()` instead, prevents merge conflicts)
- NEVER create custom SVG icons when lucide-react has an equivalent (inconsistent icon style)
- NEVER use arbitrary spacing values like `p-[23px]` — use the 4px-base scale (visual inconsistency)
- NEVER use `text-muted-foreground` for callout icons — match icon color to the callout's `accentColor` (looks broken)
</rules>

---

## Architecture

All tokens live in `apps/web/src/index.css` (`:root` for light, `.dark` for dark, `@theme inline {}` for Tailwind registration). Components live in `apps/web/src/components/ui/`. The color space is OKLCH for perceptual uniformity. Category theming uses `.category-*` classes on containers, exposing `--category-accent` and `--category-accent-soft` CSS variables to children. Block components use `BlockWrapper` with 5 variants (card, accent, code, inline, transparent) and premium CSS utilities (`stagger-children`, `hover-lift`, `glass-surface`, `text-gradient-*`, `fade-divider`, `*-glow`).

---

## When Working On...

| Task | Read | Key Patterns |
|------|------|-------------|
| Choosing/using icons | [icons.md](resources/icons.md) | Semantic mappings, sizing by context, `StatusIcon` component |
| Colors, spacing, theming | [tokens.md](resources/tokens.md) | OKLCH tokens, category accents, premium utilities, dark mode |
| Building components with CVA/shadcn | [components.md](resources/components.md) | CVA structure, BlockWrapper, compound components, `cn()` |
| Translating Figma designs | [figma.md](resources/figma.md) | MCP tools, token mapping, design-to-code workflow |
| Component documentation | [storybook.md](resources/storybook.md) | Not yet configured; future setup patterns |

---

## Rules Summary

Every design decision must trace to a semantic token defined in `index.css` — never hardcode colors, and always prefer OKLCH values in `:root`/`.dark` with `@theme inline` registration. Use shadcn/ui primitives before building custom components; when variants are needed, reach for CVA immediately. Icons come exclusively from lucide-react with project-specific semantic mappings; they must use Tailwind sizing classes (`h-4 w-4`), semantic color tokens, and `shrink-0` in flex layouts. Block components wrap in `BlockWrapper`, apply `stagger-children` to lists with more than 3 items, use `hover-lift` on interactive sub-cards, and match callout icon colors to `accentColor`. Class merging always goes through `cn()`, never string concatenation.
