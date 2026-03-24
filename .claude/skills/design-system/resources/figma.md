# Figma Integration

Translate Figma designs to code using MCP tools and existing design tokens.

<rules>
- ALWAYS map Figma colors to existing semantic tokens before creating new ones (token sprawl if violated)
- ALWAYS map Figma components to shadcn/ui equivalents first (duplicate components if violated)
- ALWAYS use Lucide icons instead of exporting icons from Figma when equivalents exist (inconsistent icon system)
- NEVER create one-off colors not in the token system (breaks theming)
- NEVER use arbitrary Tailwind values like `w-[137px]` unless truly a fixed external constraint (visual inconsistency)
- NEVER replicate Figma layout structure 1:1 — adapt to React component patterns (poor component architecture)
</rules>

---

## MCP Tools

| Tool | Purpose |
|------|---------|
| `get_figma_data` | Fetch design structure, styles, properties |
| `download_figma_images` | Export images/icons from Figma |

Get the file key from URL: `figma.com/design/[FILE_KEY]/...`

---

## Design-to-Code Workflow

1. **Fetch structure** with `get_figma_data` using file key
2. **Map colors** to existing tokens — `#FF6B35` = `category-cooking`, not a new color
3. **Map spacing** to Tailwind scale — 16px = `p-4`, 24px = `p-6`
4. **Map typography** — 14px/500 = `text-sm font-medium`, 24px/600 = `text-2xl font-semibold`
5. **Map components** to shadcn/ui — Button Primary = `<Button>`, Modal = `<Dialog>`, Card = `<Card>`
6. **Export only non-Lucide assets** with `download_figma_images`
7. **Implement** using existing design system patterns

## Token Mapping Reference

| Figma Token | CSS Variable | Tailwind |
|-------------|-------------|----------|
| Colors/Primary | `--primary` | `bg-primary`, `text-primary` |
| Colors/Background | `--background` | `bg-background` |
| Colors/Muted | `--muted` | `bg-muted`, `text-muted-foreground` |
| Spacing/Small | 8px | `p-2`, `gap-2` |
| Spacing/Medium | 16px | `p-4`, `gap-4` |
| Spacing/Large | 24px | `p-6`, `gap-6` |
| Radius/Default | `--radius` | `rounded-lg` |

---

## Edge Cases

- **Figma uses a color not in the token system**: Check if it is close to an existing token (within OKLCH lightness 5%). If so, use the existing token. If truly new and used in 3+ places, add it following the token creation process in tokens.md.
- **Figma spacing does not match scale**: Round to the nearest scale value. Document the deviation only if it creates a visible layout issue.

---

## Rules Summary

Every Figma design element must map to an existing design token, shadcn/ui component, or Lucide icon before creating anything new. Use MCP tools to extract structure, then translate through the token mapping — colors to semantic variables, spacing to Tailwind scale, components to shadcn/ui primitives. Export only assets that have no Lucide equivalent. Adapt Figma's layout structure to React component patterns rather than replicating it literally.
