# Styling Guide - Tailwind CSS v4 + shadcn/ui

> **For component patterns**, see [COMPONENTS.md](./COMPONENTS.md) > **For state management**, see [STATE.md](./STATE.md)

---

## Quick Start

### Install Dependencies

```bash
# Tailwind v4 + Vite plugin (no PostCSS needed!)
pnpm add tailwindcss @tailwindcss/vite

# shadcn/ui utilities
pnpm add clsx tailwind-merge class-variance-authority

# Icons + Animations
pnpm add lucide-react tw-animate-css
```

### Configure Vite

```typescript
// vite.config.ts
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

### Initialize shadcn/ui

```bash
pnpm dlx shadcn@latest init
# Style: New York
# Base color: Zinc
# CSS variables: Yes
```

---

## Tailwind v4: CSS-First Configuration

### DO ✅ - Configure theme in CSS with `@theme`

```css
/* src/index.css */
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  /* Colors (OKLCH for better gradients) */
  --color-background: oklch(100% 0 0);
  --color-foreground: oklch(14.1% 0.005 285.82);
  --color-primary: oklch(20.5% 0.015 285.82);
  --color-primary-foreground: oklch(98.5% 0 0);

  /* Semantic */
  --color-destructive: oklch(57.7% 0.245 27.33);
  --color-success: oklch(59.6% 0.145 163.22);
  --color-warning: oklch(79.5% 0.184 86.05);

  /* Border & Input */
  --color-border: oklch(91.4% 0.004 285.82);
  --color-ring: oklch(20.5% 0.015 285.82);

  /* Radius */
  --radius: 0.625rem;
}

.dark {
  --color-background: oklch(14.1% 0.005 285.82);
  --color-foreground: oklch(98.5% 0 0);
  /* ... other dark overrides */
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

### DON'T ❌ - Use tailwind.config.ts for colors (v4 ignores this!)

```typescript
// THIS DOES NOT WORK IN TAILWIND v4!
export default {
  theme: {
    extend: {
      colors: {
        primary: "hsl(var(--primary))", // IGNORED in v4
      },
    },
  },
};
```

### DON'T ❌ - Use v3 directive syntax

```css
/* These no longer work in v4 */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## Breaking Changes from v3 to v4

### Utility Scale Shifts

| v3 Name        | v4 Name          | Notes               |
| -------------- | ---------------- | ------------------- |
| `shadow-sm`    | `shadow-xs`      | Scale shifted down  |
| `shadow`       | `shadow-sm`      | Scale shifted down  |
| `rounded-sm`   | `rounded-xs`     | Scale shifted down  |
| `rounded`      | `rounded-sm`     | Scale shifted down  |
| `ring`         | `ring-3`         | Now defaults to 1px |
| `outline-none` | `outline-hidden` | Name clarification  |

### DO ✅ - Use v4 utility names

```html
<!-- What was shadow-sm in v3 is now shadow-xs -->
<div class="shadow-xs rounded-xs">Matches v3 shadow-sm rounded-sm</div>

<!-- Ring now needs explicit width -->
<button class="focus:ring-3 focus:ring-blue-500">Explicit ring width</button>
```

### DON'T ❌ - Assume default border color

```html
<!-- Border now uses currentColor, not gray-200 -->
<div class="border">Border will be currentColor!</div>
```

### DO ✅ - Always specify border color

```html
<div class="border border-border">Explicit color</div>
```

### Syntax Changes

```html
<!-- Variable shorthand: brackets → parentheses -->
<!-- ❌ v3 -->
<div class="bg-[--brand-color]">
  <!-- ✅ v4 -->
  <div class="bg-(--brand-color)">
    <!-- Important modifier: ! moves to end -->
    <!-- ❌ v3 -->
    <div class="!flex hover:!bg-red-500">
      <!-- ✅ v4 -->
      <div class="flex! hover:bg-red-500!">
        <!-- Variant stacking: right-to-left → left-to-right -->
        <!-- ❌ v3 -->
        <ul class="first:*:pt-0">
          <!-- ✅ v4 -->
          <ul class="*:first:pt-0"></ul>
        </ul>
      </div>
    </div>
  </div>
</div>
```

### Removed Utilities

```html
<!-- ❌ Removed -->
<div class="bg-opacity-50 text-opacity-75">
  <!-- ✅ Use -->
  <div class="bg-black/50 text-black/75">
    <!-- ❌ Removed -->
    <div class="flex-shrink-0 flex-grow">
      <!-- ✅ Use -->
      <div class="shrink-0 grow"></div>
    </div>
  </div>
</div>
```

---

## The `cn()` Utility

**Essential for merging Tailwind classes safely.**

```typescript
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### DO ✅ - Use cn() for class merging

```tsx
<div
  className={cn(
    "rounded-lg border bg-card p-6", // Base styles
    isActive && "ring-2 ring-primary", // Conditional
    className // Allow overrides
  )}
/>
```

### DON'T ❌ - String concatenation

```tsx
// Messy and error-prone
<div className={'p-4 ' + (isActive ? 'bg-blue-500 ' : '') + (size === 'lg' ? 'text-xl' : 'text-sm')}>
```

---

## Component Variants with CVA

### DO ✅ - Type-safe variants

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base styles (always applied)
  "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border border-input bg-background hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-9 px-4 text-sm",
        lg: "h-10 px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    compoundVariants: [{ variant: "outline", size: "lg", class: "border-2" }],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

// Export both for flexible usage
export { Button, buttonVariants };
```

### DON'T ❌ - If statements for variants

```tsx
// Hard to maintain, no type safety
function Button({ variant, size }) {
  let classes = "px-4 py-2 rounded";

  if (variant === "primary") classes += " bg-blue-500";
  else if (variant === "secondary") classes += " bg-gray-200";

  return <button className={classes} />;
}
```

---

## Semantic Colors

### DO ✅ - Use semantic color names

```tsx
// Adapts to light/dark mode automatically
<div className="bg-background text-foreground" />
<div className="bg-card text-card-foreground" />
<button className="bg-primary text-primary-foreground" />
<p className="text-muted-foreground" />
<span className="text-destructive" />
```

### DON'T ❌ - Hardcode colors

```tsx
// Won't work with dark mode, breaks consistency
<div className="bg-white text-gray-900" />
<button className="bg-blue-600 text-white" />
```

### DON'T ❌ - Duplicate dark mode classes with CSS variables

```tsx
// WRONG - CSS variables handle this automatically
<div className="bg-primary dark:bg-primary-dark" />

// CORRECT - single class, adapts to theme
<div className="bg-primary" />
```

---

## Building Components from Scratch

When NOT using shadcn, follow these patterns:

### DO ✅ - Forward refs and spread props

```tsx
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, elevated = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border bg-card p-6 text-card-foreground",
        elevated && "shadow-lg",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

export { Card };
```

### DO ✅ - Use complete class strings (for JIT compilation)

```tsx
// Safe - complete strings
const width = isWide ? "w-1/2" : "w-1/3";
const color = isPrimary ? "bg-primary" : "bg-secondary";
```

### DON'T ❌ - Dynamically construct class names

```tsx
// WON'T WORK - not compiled
const width = `w-1/${columns}`;
const bgColor = `bg-${colorName}-500`;
```

### DO ✅ - Include all interactive states

```tsx
<button
  className="
  bg-primary text-primary-foreground
  hover:bg-primary/90
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
  active:scale-95
  disabled:pointer-events-none disabled:opacity-50
  transition-colors
"
>
  Complete States
</button>
```

### DON'T ❌ - Forget hover/focus states

```tsx
// Incomplete - no feedback
<button className="bg-primary text-white">Missing States</button>
```

---

## Responsive Design

### DO ✅ - Mobile-first (add breakpoints for larger screens)

```tsx
<div className="
  flex flex-col gap-4      /* Mobile: stack */
  md:flex-row md:gap-6     /* Tablet+: row */
  lg:gap-8                 /* Desktop: more space */
">
```

### DON'T ❌ - Desktop-first (harder to maintain)

```tsx
// Confusing - overriding for smaller screens
<div className="flex-row md:flex-col sm:flex-col">
```

### DON'T ❌ - Think sm: means "small screens"

```tsx
// WRONG - sm: means 640px and UP, not mobile!
<div className="sm:text-center" />  // Centers on 640px+, NOT mobile!

// CORRECT - start with mobile, override for larger
<div className="text-center md:text-left" />
```

### Breakpoint Reference

| Prefix | Min Width | Target           |
| ------ | --------- | ---------------- |
| (none) | 0px       | Mobile (default) |
| `sm:`  | 640px     | Large phones     |
| `md:`  | 768px     | Tablets          |
| `lg:`  | 1024px    | Laptops          |
| `xl:`  | 1280px    | Desktops         |
| `2xl:` | 1536px    | Large monitors   |

---

## Dark Mode

### DO ✅ - Prevent flash with inline script

```html
<!-- Add to <head> BEFORE body renders -->
<script>
  (function () {
    const theme = localStorage.getItem("vie-theme");
    if (
      theme === "dark" ||
      (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      document.documentElement.classList.add("dark");
    }
  })();
</script>
```

### DO ✅ - Include dark states for interactive elements

```tsx
<button
  className="
  bg-blue-500 hover:bg-blue-600 focus:ring-blue-500
  dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-400
"
>
  Complete dark mode coverage
</button>
```

### Theme Provider Pattern

```tsx
// src/components/theme-provider.tsx
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({ theme: "system", setTheme: () => {} });

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vie-theme",
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme: (t) => {
          localStorage.setItem(storageKey, t);
          setTheme(t);
        },
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

---

## Animation

### DO ✅ - Use tw-animate-css for entry/exit

```tsx
// Fade in
<div className="animate-in fade-in duration-300">

// Slide up
<div className="animate-in slide-in-from-bottom-4 duration-300">

// Combined
<div className="animate-in fade-in slide-in-from-bottom-4 duration-300">

// Exit
<div className="animate-out fade-out slide-out-to-bottom-4">
```

### DO ✅ - Be specific about transitions (better performance)

```tsx
<button className="transition-colors duration-200 hover:bg-accent">
  Specific transition
</button>

<div className="transition-transform duration-200 hover:scale-105">
  Transform only
</div>
```

### DON'T ❌ - Use transition-all

```tsx
// Causes unnecessary repaints
<div className="transition-all duration-200" />
```

### DON'T ❌ - Animate layout properties

```tsx
// Causes layout thrashing (slow)
<div className="hover:mt-[-4px] hover:w-[102%]">

// Use transform instead (GPU accelerated)
<div className="hover:-translate-y-1 hover:scale-[1.02]">
```

### DO ✅ - Respect reduced motion preferences

```tsx
<div
  className="
  motion-safe:animate-bounce
  motion-reduce:animate-none
"
>
  Only animates if user allows motion
</div>
```

---

## Accessibility

### DO ✅ - Use focus-visible for keyboard-only focus

```tsx
<button
  className="
  focus:outline-none
  focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
"
>
  Better UX for both input methods
</button>
```

### DO ✅ - Use sr-only for icon-only buttons

```tsx
<button>
  <XIcon className="h-5 w-5" aria-hidden="true" />
  <span className="sr-only">Close menu</span>
</button>
```

### DON'T ❌ - Remove focus outlines without replacement

```tsx
// Inaccessible!
<button className="focus:outline-none">No focus indicator</button>
```

---

## Spacing System

| Class           | Value | Use For               |
| --------------- | ----- | --------------------- |
| `gap-1` / `p-1` | 4px   | Tight (icon gaps)     |
| `gap-2` / `p-2` | 8px   | Small (related items) |
| `gap-3` / `p-3` | 12px  | Compact cards         |
| `gap-4` / `p-4` | 16px  | Standard              |
| `gap-6` / `p-6` | 24px  | Card padding          |
| `gap-8` / `p-8` | 32px  | Section spacing       |

### DO ✅ - Consistent spacing

```tsx
<Card className="p-6">
  <div className="space-y-4">
    <h3>Title</h3>
    <p>Content</p>
  </div>
</Card>
```

### DON'T ❌ - Random values

```tsx
<Card className="p-[23px]">
  <div className="mb-[17px]">
    <h3 className="pb-[11px]">Title</h3>
  </div>
</Card>
```

---

## Typography

```tsx
// Headings
<h1 className="text-4xl font-bold tracking-tight">Page Title</h1>
<h2 className="text-3xl font-semibold tracking-tight">Section</h2>
<h3 className="text-2xl font-semibold">Subsection</h3>
<h4 className="text-xl font-medium">Card Title</h4>

// Body
<p className="text-base text-foreground">Normal text</p>
<p className="text-sm text-muted-foreground">Secondary text</p>
<p className="text-xs text-muted-foreground">Caption</p>

// Code
<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">code</code>
```

---

## Common Gotchas

| Problem                | Solution                                             |
| ---------------------- | ---------------------------------------------------- |
| Colors not working     | Define in `@theme inline`, not `tailwind.config.ts`  |
| Dark mode broken       | Check `.dark` class on `<html>`, use semantic colors |
| Classes not merging    | Use `cn()` helper, not string concatenation          |
| Animation jank         | Use `transform`/`opacity`, not layout properties     |
| Ring different than v3 | Add explicit width: `ring-3` instead of `ring`       |
| Border wrong color     | Always specify: `border border-border`               |
| Classes not compiling  | Use complete strings, not dynamic construction       |

---

## Quick Reference

| Task               | Solution                                        |
| ------------------ | ----------------------------------------------- |
| Merge classes      | `cn("base", conditional && "class", className)` |
| Component variants | CVA with `VariantProps`                         |
| Responsive         | Mobile-first: `flex-col md:flex-row`            |
| Dark mode          | CSS variables + `.dark` class                   |
| Semantic colors    | `bg-primary`, `text-muted-foreground`           |
| Entry animations   | `animate-in fade-in slide-in-from-bottom-4`     |
| Hover transitions  | `transition-colors hover:bg-accent`             |
| Focus states       | `focus-visible:ring-2 focus-visible:ring-ring`  |

---

## Full Theme Template

```css
/* src/index.css */
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  /* Base */
  --color-background: oklch(100% 0 0);
  --color-foreground: oklch(14.1% 0.005 285.82);

  /* Card & Popover */
  --color-card: oklch(100% 0 0);
  --color-card-foreground: oklch(14.1% 0.005 285.82);
  --color-popover: oklch(100% 0 0);
  --color-popover-foreground: oklch(14.1% 0.005 285.82);

  /* Primary */
  --color-primary: oklch(20.5% 0.015 285.82);
  --color-primary-foreground: oklch(98.5% 0 0);

  /* Secondary */
  --color-secondary: oklch(96.7% 0.001 285.82);
  --color-secondary-foreground: oklch(21% 0.006 285.82);

  /* Muted */
  --color-muted: oklch(96.7% 0.001 285.82);
  --color-muted-foreground: oklch(55.2% 0.014 285.82);

  /* Accent */
  --color-accent: oklch(96.7% 0.001 285.82);
  --color-accent-foreground: oklch(21% 0.006 285.82);

  /* Semantic */
  --color-destructive: oklch(57.7% 0.245 27.33);
  --color-success: oklch(59.6% 0.145 163.22);
  --color-warning: oklch(79.5% 0.184 86.05);
  --color-info: oklch(62.3% 0.214 259.53);

  /* Border & Input */
  --color-border: oklch(91.4% 0.004 285.82);
  --color-input: oklch(91.4% 0.004 285.82);
  --color-ring: oklch(20.5% 0.015 285.82);

  /* Radius */
  --radius: 0.625rem;
}

.dark {
  --color-background: oklch(14.1% 0.005 285.82);
  --color-foreground: oklch(98.5% 0 0);
  --color-card: oklch(14.1% 0.005 285.82);
  --color-card-foreground: oklch(98.5% 0 0);
  --color-popover: oklch(14.1% 0.005 285.82);
  --color-popover-foreground: oklch(98.5% 0 0);
  --color-primary: oklch(98.5% 0 0);
  --color-primary-foreground: oklch(20.5% 0.015 285.82);
  --color-secondary: oklch(26.9% 0.006 285.82);
  --color-secondary-foreground: oklch(98.5% 0 0);
  --color-muted: oklch(26.9% 0.006 285.82);
  --color-muted-foreground: oklch(71.2% 0.013 285.82);
  --color-accent: oklch(26.9% 0.006 285.82);
  --color-accent-foreground: oklch(98.5% 0 0);
  --color-destructive: oklch(65.4% 0.222 17.57);
  --color-border: oklch(26.9% 0.006 285.82);
  --color-input: oklch(26.9% 0.006 285.82);
  --color-ring: oklch(83.9% 0.021 285.82);
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```
