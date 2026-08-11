# Lucide Icons

Lucide-react integration with Tailwind CSS, accessibility, and shadcn/ui.

<rules>
- ALWAYS use named imports for tree-shaking — `import { Camera } from "lucide-react"` (causes 500KB+ bundle if wildcard imported)
- ALWAYS size icons with Tailwind classes (`className="h-4 w-4"`) — never mix `size` prop and classes inconsistently (causes sizing inconsistency across codebase)
- ALWAYS add `aria-label` on the button (not the icon) for icon-only buttons, plus `aria-hidden="true"` on the icon (causes screen reader confusion if labeled on wrong element)
- ALWAYS use `shrink-0` in flex layouts to prevent icon squishing (causes distorted icons in tight layouts)
- ALWAYS use Tailwind text color classes for icon color — icons inherit `currentColor` (causes inconsistency if using color prop)
- NEVER import `* as icons` from lucide-react (causes entire library in bundle, ~500KB)
- NEVER use dynamic `require()` for icon names (breaks tree-shaking — use a static ICON_MAP object instead)
</rules>

---

## Standard Patterns

```tsx
// Icon + text button
<Button><Plus className="h-4 w-4 mr-2" />Add Item</Button>

// Icon-only button (accessible)
<Button size="icon" aria-label="Delete item">
  <Trash2 className="h-4 w-4" aria-hidden="true" />
</Button>

// Muted secondary icon
<Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

// Loading state
<Loader2 className="h-4 w-4 animate-spin" />

// Filled icon (Heart, Star, Bookmark)
<Heart className="h-4 w-4 fill-red-500 text-red-500" />
```

---

## shadcn/ui Integration

shadcn/ui Button auto-sizes icons via `[&_svg]:size-4`. Override with explicit classes when needed.

```tsx
<Button><Plus /> Add</Button>           {/* Auto-sized */}
<Button><Plus className="h-5 w-5" /> Add</Button>  {/* Override */}
```

---

## Dynamic Icons

Only when icon name comes from database/API. Prefer a static map over dynamic imports.

```tsx
const ICON_MAP = { camera: Camera, user: User } as const;
const Icon = ICON_MAP[iconName];
```

---

## Touch Targets

Minimum 44x44px hit area. Achieve with padding on the button, not by enlarging the icon.

```tsx
<button className="p-2">
  {" "}
  {/* 32px icon + 16px padding = 48px target */}
  <Menu className="h-8 w-8" />
</button>
```

---

## Edge Cases

- **Icons in flex containers:** Always add `shrink-0` to prevent compression when sibling text is long.
- **Fill vs stroke:** Most Lucide icons are stroke-only. Fill works on Heart, Star, Bookmark, Eye, Bell. Use `fill-current` or specific fill color classes.
- **Icon-only without button:** If an icon conveys meaning but is not interactive, use `role="img"` and `aria-label` on a wrapping span, not on the SVG.

---

## Rules Summary

Import icons by name for tree-shaking. Size with Tailwind h-/w- classes, color via text-\* classes (inherits currentColor). Icon-only buttons need aria-label on the button and aria-hidden on the icon. Use shrink-0 in flex layouts, Loader2 with animate-spin for loading, and static ICON_MAP for dynamic icon names. Touch targets are 44px minimum via padding, not icon size.
