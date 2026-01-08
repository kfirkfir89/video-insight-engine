# Styling Patterns

Tailwind CSS, CSS Modules, and styling best practices.

---

## Tailwind CSS

### DO ✅

```tsx
// Utility-first styling
function Button({ variant, children }: ButtonProps) {
  const baseStyles = 'px-4 py-2 rounded-lg font-medium transition-colors';
  
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };

  return (
    <button className={`${baseStyles} ${variants[variant]}`}>
      {children}
    </button>
  );
}
```

### With clsx/cn helper

```tsx
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility to merge Tailwind classes safely
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Usage
function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-white p-6 shadow-sm',
        className // Allow overrides
      )}
      {...props}
    />
  );
}
```

### DON'T ❌

```tsx
// Inline string concatenation mess
<div className={'p-4 ' + (isActive ? 'bg-blue-500 ' : '') + (size === 'lg' ? 'text-xl' : 'text-sm')}>
```

---

## CSS Variables for Theming

### DO ✅

```css
/* globals.css */
:root {
  --color-primary: 59 130 246; /* RGB values */
  --color-background: 255 255 255;
  --color-text: 17 24 39;
}

.dark {
  --color-primary: 96 165 250;
  --color-background: 17 24 39;
  --color-text: 243 244 246;
}
```

```tsx
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        background: 'rgb(var(--color-background) / <alpha-value>)',
      },
    },
  },
};

// Usage
<div className="bg-background text-primary">Themed!</div>
```

---

## CSS Modules

### DO ✅

```css
/* Button.module.css */
.button {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 500;
}

.primary {
  background-color: var(--color-primary);
  color: white;
}

.secondary {
  background-color: var(--color-secondary);
  color: var(--color-text);
}
```

```tsx
import styles from './Button.module.css';

function Button({ variant = 'primary', children }: ButtonProps) {
  return (
    <button className={`${styles.button} ${styles[variant]}`}>
      {children}
    </button>
  );
}
```

---

## Component Variants with CVA

### DO ✅

```tsx
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  // Base styles
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2',
  {
    variants: {
      variant: {
        primary: 'bg-blue-600 text-white hover:bg-blue-700',
        secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
        ghost: 'hover:bg-gray-100',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

function Button({ variant, size, className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
```

---

## Responsive Design

### DO ✅

```tsx
// Mobile-first with Tailwind breakpoints
<div className="
  flex flex-col          /* Mobile: stack */
  md:flex-row            /* Tablet+: side by side */
  lg:gap-8               /* Desktop: more spacing */
">
  <aside className="
    w-full               /* Mobile: full width */
    md:w-64              /* Tablet+: fixed sidebar */
    lg:w-80
  ">
    Sidebar
  </aside>
  <main className="flex-1">
    Content
  </main>
</div>
```

### DON'T ❌

```tsx
// Desktop-first (harder to maintain)
<div className="flex-row md:flex-col sm:flex-col">
```

---

## Animation

### DO ✅

```tsx
// CSS transitions
<button className="
  transition-all duration-200
  hover:scale-105 hover:shadow-lg
  active:scale-95
">
  Animated Button
</button>

// Tailwind animate utilities
<div className="animate-spin" />    // Spinner
<div className="animate-pulse" />   // Skeleton loading
<div className="animate-bounce" />  // Attention

// Custom animations in config
// tailwind.config.ts
animation: {
  'fade-in': 'fadeIn 0.3s ease-out',
  'slide-up': 'slideUp 0.3s ease-out',
},
keyframes: {
  fadeIn: {
    '0%': { opacity: '0' },
    '100%': { opacity: '1' },
  },
  slideUp: {
    '0%': { transform: 'translateY(10px)', opacity: '0' },
    '100%': { transform: 'translateY(0)', opacity: '1' },
  },
},
```

---

## Dark Mode

### DO ✅

```tsx
// Toggle with class strategy
function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  return (
    <button onClick={() => setIsDark(!isDark)}>
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}

// Components use dark: prefix
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  Works in both modes
</div>
```

---

## Design Tokens

### DO ✅

```tsx
// Define spacing, colors, typography in config
// tailwind.config.ts
export default {
  theme: {
    extend: {
      spacing: {
        'page': '1rem',      // Page padding
        'section': '2rem',   // Section spacing
        'card': '1.5rem',    // Card padding
      },
      fontSize: {
        'heading-1': ['2.5rem', { lineHeight: '1.2', fontWeight: '700' }],
        'heading-2': ['2rem', { lineHeight: '1.3', fontWeight: '600' }],
        'body': ['1rem', { lineHeight: '1.6' }],
      },
    },
  },
};

// Usage
<h1 className="text-heading-1">Title</h1>
<p className="text-body">Content</p>
```

---

## Quick Reference

| Approach | When to Use |
|----------|-------------|
| Tailwind utilities | Most styling |
| CVA | Component variants |
| CSS Modules | Third-party CSS isolation |
| CSS Variables | Theming, dynamic values |
| Inline styles | Truly dynamic values (animations) |

| Tailwind Pattern | Example |
|-----------------|---------|
| Responsive | `md:flex lg:grid` |
| Dark mode | `dark:bg-gray-900` |
| State | `hover:bg-blue-600 focus:ring-2` |
| Group | `group-hover:opacity-100` |
| Peer | `peer-checked:bg-blue-500` |
