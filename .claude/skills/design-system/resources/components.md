# Component Patterns

CVA variants, shadcn/ui conventions, and component architecture for vie-web.

---

## shadcn/ui Inventory

Available components in `apps/web/src/components/ui/`:

### Form Controls
- `button.tsx` - Button with variants
- `input.tsx` - Text input
- `textarea.tsx` - Multi-line input
- `checkbox.tsx` - Checkbox
- `switch.tsx` - Toggle switch
- `select.tsx` - Dropdown select
- `slider.tsx` - Range slider

### Feedback
- `alert.tsx` - Alert banners
- `badge.tsx` - Status badges
- `skeleton.tsx` - Loading placeholders
- `progress.tsx` - Progress bars
- `status-icon.tsx` - Status indicators (custom)
- `spinner.tsx` - Loading spinner (custom)

### Overlays
- `dialog.tsx` - Modal dialogs
- `sheet.tsx` - Slide-out panels
- `dropdown-menu.tsx` - Context menus
- `popover.tsx` - Popovers
- `tooltip.tsx` - Tooltips
- `context-menu.tsx` - Right-click menus

### Navigation
- `tabs.tsx` - Tab navigation
- `navigation-menu.tsx` - Nav menus
- `breadcrumb.tsx` - Breadcrumbs

### Layout
- `card.tsx` - Card containers
- `separator.tsx` - Dividers
- `scroll-area.tsx` - Custom scrollbars
- `collapsible.tsx` - Expandable sections
- `sidebar.tsx` - App sidebar (custom)

### Data Display
- `table.tsx` - Data tables
- `avatar.tsx` - User avatars

---

## CVA Pattern

Class Variance Authority (CVA) for type-safe component variants:

### Basic Structure

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base classes (always applied)
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
```

### Key Elements

1. **Base classes** - Styles shared by all variants
2. **Variants object** - Mutually exclusive options
3. **defaultVariants** - Fallback when prop not provided
4. **VariantProps** - Type inference for props
5. **cn()** - Merges with custom className

---

## cn() Utility

The `cn()` function merges Tailwind classes intelligently:

```tsx
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Usage

```tsx
// Conditional classes
cn("base", isActive && "active", isDisabled && "opacity-50")

// Merging with overrides
cn("px-4 py-2", className) // className can override padding

// Arrays and objects
cn(["class1", "class2"], { "class3": condition })
```

---

## shadcn/ui Conventions

### data-slot Attribute

Components use `data-slot` for CSS targeting:

```tsx
<article data-slot="article-section">
  <header data-slot="article-header">...</header>
</article>
```

```css
/* Performance optimization */
[data-slot="article-section"] {
  contain: layout style;
}
```

### asChild Pattern

Render as a different element using Radix Slot:

```tsx
// Default: renders as <button>
<Button>Click me</Button>

// With asChild: renders as <a>
<Button asChild>
  <a href="/path">Click me</a>
</Button>

// With asChild: renders as Link
<Button asChild>
  <Link to="/path">Click me</Link>
</Button>
```

### Compound Components

Complex components use sub-components:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    Content here
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>

<Dialog>
  <DialogTrigger asChild>
    <Button>Open</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    {/* Content */}
    <DialogFooter>
      <Button>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Component Architecture

### Container vs Presentational

```
Container (Smart)                 Presentational (Dumb)
───────────────────               ────────────────────
• Fetches data                    • Receives props
• Manages state                   • Renders UI
• Handles events                  • Calls prop callbacks
• Knows about context             • No side effects
• Usually not reusable            • Highly reusable

Example: VideoDetailPage          Example: VideoCard, StatusIcon
```

### Status Mapping Pattern

Map status values to visual variants:

```tsx
const STATUS_STYLES = {
  pending: "text-status-pending",
  processing: "text-status-processing",
  completed: "text-status-success",
  failed: "text-status-error",
} as const;

const STATUS_ICONS = {
  pending: Clock,
  processing: Loader2,
  completed: CheckCircle,
  failed: AlertCircle,
} as const;

function StatusBadge({ status }: { status: keyof typeof STATUS_STYLES }) {
  const Icon = STATUS_ICONS[status];
  return (
    <span className={cn("flex items-center gap-1", STATUS_STYLES[status])}>
      <Icon className="h-4 w-4" />
      {status}
    </span>
  );
}
```

### Block Components

Content blocks with consistent structure:

```tsx
interface BlockProps {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}

function ContentBlock({ title, icon: Icon, children, className }: BlockProps) {
  return (
    <section className={cn("rounded-lg border p-4", className)}>
      <header className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
        <h3 className="font-semibold">{title}</h3>
      </header>
      <div className="text-sm text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
```

---

## Focus & Accessibility

### Focus Ring Pattern

```tsx
// Standard focus ring
"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

// Focus within container
"focus-within:ring-2 focus-within:ring-ring"

// Custom focus (using CSS variable)
"focus-visible:shadow-[var(--focus-ring)]"
```

### Keyboard Navigation

```tsx
// Roving tabindex for lists
function List({ items }) {
  const [focusIndex, setFocusIndex] = useState(0);

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        setFocusIndex(i => Math.min(i + 1, items.length - 1));
        break;
      case "ArrowUp":
        setFocusIndex(i => Math.max(i - 1, 0));
        break;
    }
  };

  return (
    <ul onKeyDown={handleKeyDown}>
      {items.map((item, i) => (
        <li key={item.id} tabIndex={i === focusIndex ? 0 : -1}>
          {item.name}
        </li>
      ))}
    </ul>
  );
}
```

---

## Loading States

### Button Loading

```tsx
<Button disabled={isLoading}>
  {isLoading ? (
    <>
      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      Loading...
    </>
  ) : (
    <>
      <Save className="h-4 w-4 mr-2" />
      Save
    </>
  )}
</Button>
```

### Skeleton Loading

```tsx
import { Skeleton } from "@/components/ui/skeleton";

function VideoCardSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

// Usage with Suspense or loading state
{isLoading ? (
  <VideoCardSkeleton />
) : (
  <VideoCard video={video} />
)}
```

---

## Toast Notifications

Using Sonner (pre-configured):

```tsx
import { toast } from "sonner";

// Success
toast.success("Video saved successfully");

// Error
toast.error("Failed to save video", {
  description: "Please try again later",
});

// Promise (auto-handles states)
toast.promise(saveVideo(data), {
  loading: "Saving...",
  success: "Saved!",
  error: "Failed to save",
});

// Custom
toast("Custom message", {
  action: {
    label: "Undo",
    onClick: () => handleUndo(),
  },
});
```

---

## New Component Checklist

When creating a new component:

- [ ] Check if shadcn/ui has it (don't reinvent)
- [ ] Use CVA if variants needed
- [ ] Forward ref for DOM access
- [ ] Accept `className` prop for customization
- [ ] Use `cn()` for class merging
- [ ] Use semantic color tokens
- [ ] Add `data-slot` for CSS targeting if complex
- [ ] Handle loading/disabled states
- [ ] Test keyboard navigation
- [ ] Add aria attributes where needed

### Template

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const componentVariants = cva(
  "base-classes",
  {
    variants: {
      variant: {
        default: "default-styles",
      },
      size: {
        default: "default-size",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface ComponentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof componentVariants> {}

const Component = React.forwardRef<HTMLDivElement, ComponentProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(componentVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Component.displayName = "Component";

export { Component, componentVariants };
```

---

## Anti-Patterns

```tsx
// DON'T: Inline styles for themeable values
<div style={{ backgroundColor: "#ffffff" }}>

// DO: Semantic classes
<div className="bg-background">

// DON'T: Raw Tailwind for reusable patterns
<button className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white h-10 px-4">

// DO: CVA for variants
<Button variant="primary" size="default">

// DON'T: Recreate existing shadcn components
function MyDialog() { /* custom implementation */ }

// DO: Extend or compose shadcn components
<Dialog>
  <DialogContent className="max-w-2xl">
    {/* custom content */}
  </DialogContent>
</Dialog>

// DON'T: String concatenation for classes
<div className={"base " + (isActive ? "active" : "")}>

// DO: cn() utility
<div className={cn("base", isActive && "active")}>
```
