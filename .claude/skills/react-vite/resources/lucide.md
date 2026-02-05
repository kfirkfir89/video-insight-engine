# Lucide Icons for React

Lucide-react is a tree-shakeable SVG icon library. This guide covers integration with Tailwind CSS and React.

---

## Import Patterns

### Named Imports (Always Use)

```tsx
// DO: Named imports enable tree-shaking
import { Camera, User, Settings } from "lucide-react";

// DON'T: Imports entire library (~500KB)
import * as icons from "lucide-react";
```

### Dynamic Icons (Avoid Unless Necessary)

```tsx
// Only use when icon name comes from database/API
import dynamicIconImports from "lucide-react/dynamicIconImports";
import { lazy, Suspense } from "react";

const Icon = lazy(dynamicIconImports["camera"]);

// Prefer: Map string to imported icon
const ICON_MAP = {
  camera: Camera,
  user: User,
} as const;
```

---

## Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | number \| string | 24 | Icon dimensions (width & height) |
| `color` | string | "currentColor" | Stroke color |
| `strokeWidth` | number | 2 | Line thickness |
| `absoluteStrokeWidth` | boolean | false | Disable stroke scaling |
| `className` | string | - | Tailwind/CSS classes |

```tsx
// Using props (for dynamic values)
<Camera size={32} strokeWidth={1.5} color="#3b82f6" />

// Using className (preferred for Tailwind)
<Camera className="h-8 w-8 stroke-1 text-blue-500" />
```

---

## Tailwind Integration

### Sizing with Classes (Preferred)

```tsx
// DO: Tailwind classes for consistent sizing
<Camera className="h-4 w-4" />   // Standard (16px)
<Camera className="h-5 w-5" />   // Medium (20px)
<Camera className="h-6 w-6" />   // Large (24px)

// DO: size prop for dynamic values
<Camera size={iconSize} />

// DON'T: Mix approaches inconsistently
<Camera size={16} className="h-4" /> // Redundant
```

### Color with Text Classes

Icons inherit `currentColor` by default, so parent text color applies:

```tsx
// Color via Tailwind
<Camera className="text-muted-foreground" />
<Camera className="text-primary" />
<Camera className="text-destructive" />

// Color in parent element
<button className="text-red-500">
  <Trash2 className="h-4 w-4" /> {/* Inherits red */}
</button>
```

### Fill for Solid Icons

Some icons support fill (Heart, Star, Bookmark):

```tsx
// Stroke only (default)
<Heart className="h-4 w-4 text-red-500" />

// Filled
<Heart className="h-4 w-4 fill-red-500 text-red-500" />

// Fill + stroke different colors
<Star className="h-4 w-4 fill-yellow-400 text-yellow-600" />
```

### Common Class Combinations

```tsx
// Icon + text button
<Button>
  <Plus className="h-4 w-4 mr-2" />
  Add Item
</Button>

// Icon-only button
<Button size="icon">
  <Settings className="h-4 w-4" />
</Button>

// Muted secondary icon
<Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

// Prevent shrinking in flex
<Film className="h-4 w-4 shrink-0" />
```

---

## Accessibility

### Decorative Icons (Default)

Icons are `aria-hidden="true"` by default - hidden from screen readers. This is correct for most cases:

```tsx
// Decorative: text provides meaning
<Button>
  <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
  Delete
</Button>
```

### Semantic Icons (Icon-Only)

When an icon is the only content, add visually-hidden text:

```tsx
// DO: Screen reader text
<button>
  <X className="h-4 w-4" aria-hidden="true" />
  <span className="sr-only">Close dialog</span>
</button>

// DON'T: aria-label on the icon itself
<button>
  <X className="h-4 w-4" aria-label="Close" /> {/* Wrong element */}
</button>
```

### Accessible Button Pattern

```tsx
// Complete accessible icon button
<Button
  variant="ghost"
  size="icon"
  aria-label="Delete item"
>
  <Trash2 className="h-4 w-4" aria-hidden="true" />
</Button>

// Or with sr-only inside
<Button variant="ghost" size="icon">
  <Trash2 className="h-4 w-4" />
  <span className="sr-only">Delete item</span>
</Button>
```

### Contrast Requirements

- **Minimum 4.5:1** ratio between icon and background
- **44x44px minimum** touch target for interactive icons (wrapper, not icon)

```tsx
// Touch target via padding, not icon size
<button className="p-2"> {/* 8px padding = 32px icon + 16px = 48px target */}
  <Menu className="h-8 w-8" />
</button>
```

---

## Loading States

Use `Loader2` with `animate-spin`:

```tsx
// Button loading state
<Button disabled>
  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
  Loading...
</Button>

// Inline loading
{isLoading ? (
  <Loader2 className="h-4 w-4 animate-spin" />
) : (
  <Check className="h-4 w-4" />
)}
```

---

## shadcn/ui Integration

shadcn/ui Button auto-sizes icons without explicit classes:

```tsx
// Icons in shadcn/ui buttons get size-4 automatically
<Button>
  <Plus /> {/* Sized by [&_svg:not([class*="size-"])]:size-4 */}
  Add
</Button>

// Override with explicit class if needed
<Button>
  <Plus className="h-5 w-5" />
  Add
</Button>
```

---

## Anti-Patterns

```tsx
// NEVER: Import all icons
import * as icons from "lucide-react";

// NEVER: Dynamic string access
const iconName = "camera";
const Icon = require(`lucide-react`)[iconName]; // Breaks tree-shaking

// AVOID: Inline color values (use Tailwind)
<Camera color="#3b82f6" /> // Use className="text-blue-500" instead

// AVOID: Inconsistent sizing approaches
<Camera size={16} />  // File A
<User className="h-4 w-4" />  // File B - pick one approach
```

---

## Quick Reference

| Use Case | Pattern |
|----------|---------|
| Standard icon | `className="h-4 w-4"` |
| With text | `className="h-4 w-4 mr-2"` |
| Muted | `className="h-4 w-4 text-muted-foreground"` |
| In flex | `className="h-4 w-4 shrink-0"` |
| Loading | `<Loader2 className="h-4 w-4 animate-spin" />` |
| Filled | `className="h-4 w-4 fill-current"` |
| Icon button | Button + `aria-label` + icon |
