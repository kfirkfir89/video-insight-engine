# Tailwind CSS Patterns

Tailwind CSS 4, CVA variants, shadcn/ui integration, responsive design, and theming.

<rules>
- ALWAYS use `cn()` (clsx + twMerge) for conditional and composable classes — never string concatenation (causes class conflicts and unreadable templates)
- ALWAYS use CVA for component variants — never if/else chains for class selection (causes inconsistent variant logic)
- ALWAYS design mobile-first — base classes for mobile, `md:` for tablet, `lg:` for desktop (causes desktop-first regressions on mobile)
- ALWAYS use CSS variables for theming with `@theme inline {}` in Tailwind v4 — never `tailwind.config.js` (project uses CSS-first config)
- ALWAYS use `dark:` prefix for dark mode styles — never duplicate component CSS (causes maintenance burden)
- NEVER use inline string concatenation for dynamic classes — use `cn()` with conditions (causes class conflict bugs that are hard to debug)
- NEVER use arbitrary z-index values — use a defined scale via CSS variables (causes z-index arms race)
</rules>

---

## cn() Utility

ALWAYS use for class composition and overrides.

```tsx
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn("rounded-xl border bg-white p-6 shadow-sm", className)}
      {...props}
    />
  );
}
```

---

## CVA Variants

ALWAYS use CVA for multi-variant components. Extends naturally with `VariantProps`.

```tsx
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2",
  {
    variants: {
      variant: {
        primary: "bg-blue-600 text-white hover:bg-blue-700",
        secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
        ghost: "hover:bg-gray-100",
        destructive: "bg-red-600 text-white hover:bg-red-700",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
```

---

## Responsive Design

ALWAYS mobile-first. Base styles for small screens, breakpoint prefixes add complexity.

```tsx
<div className="flex flex-col md:flex-row lg:gap-8">
  <aside className="w-full md:w-64 lg:w-80">Sidebar</aside>
  <main className="flex-1">Content</main>
</div>
```

---

## CSS Variables for Theming

In Tailwind v4, register tokens in `index.css` with `@theme inline {}`, not in a config file.

```css
@theme inline {
  --color-primary: oklch(0.6 0.2 260);
  --color-background: oklch(0.99 0 0);
}
```

---

## Dark Mode

Use `dark:` prefix. Define CSS variables per theme.

```tsx
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  Adapts to theme
</div>
```

---

## Animation

ALWAYS wrap animations in `prefers-reduced-motion` consideration. Use Tailwind's `motion-safe:` variant.

```tsx
<button className="transition-all duration-200 hover:scale-105 active:scale-95">
  Animated
</button>
<div className="motion-safe:animate-bounce motion-reduce:animate-none" />
```

---

## Edge Cases

- **Class conflicts:** When passing `className` as a prop, always merge with `cn()` — the last class wins in twMerge, so consumer overrides work correctly.
- **CSS Modules:** Only use for third-party CSS isolation. All project styling flows through Tailwind utilities.
- **Inline styles:** Only for truly dynamic values computed at runtime (e.g., `style={{ transform: \`translateX(${x}px)\` }}`).

---

## Rules Summary

All styling uses Tailwind utilities composed with cn(). Component variants use CVA with VariantProps. Design is mobile-first with breakpoint prefixes. Theming uses CSS variables registered via @theme inline in Tailwind v4 — never a config file. Dark mode uses the dark: prefix. Animations respect prefers-reduced-motion via motion-safe/motion-reduce variants. Z-index follows a defined scale. Class overrides always flow through cn() so consumers can customize.
