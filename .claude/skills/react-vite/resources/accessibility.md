# Accessibility (React)

ARIA, keyboard navigation, screen readers, and inclusive design patterns.

---

## Semantic HTML

### DO ✅

```tsx
// Use semantic elements
function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header role="banner">
        <nav aria-label="Main navigation">
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/about">About</a></li>
          </ul>
        </nav>
      </header>

      <main id="main-content" role="main">
        {children}
      </main>

      <footer role="contentinfo">
        <p>© 2024 Company</p>
      </footer>
    </>
  );
}

// Skip link for keyboard users
function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 
                 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-black"
    >
      Skip to main content
    </a>
  );
}
```

### DON'T ❌

```tsx
// Div soup - no semantic meaning
<div className="header">
  <div className="nav">
    <div onClick={navigate}>Home</div>
  </div>
</div>
<div className="content">{children}</div>
<div className="footer">Footer</div>
```

---

## ARIA Labels

### DO ✅

```tsx
// Button with icon only
function IconButton({ icon, label, onClick }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="p-2 rounded hover:bg-gray-100"
    >
      {icon}
    </button>
  );
}

// Usage
<IconButton icon={<TrashIcon />} label="Delete item" onClick={handleDelete} />

// Form with proper labeling
function SearchForm() {
  return (
    <form role="search" aria-label="Site search">
      <label htmlFor="search" className="sr-only">
        Search
      </label>
      <input
        id="search"
        type="search"
        placeholder="Search..."
        aria-describedby="search-hint"
      />
      <p id="search-hint" className="sr-only">
        Press Enter to search
      </p>
    </form>
  );
}

// Live regions for dynamic content
function NotificationArea({ message }: { message: string | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}

// Alert for important messages
function Alert({ message }: { message: string }) {
  return (
    <div role="alert" className="bg-red-100 p-4 rounded">
      {message}
    </div>
  );
}
```

---

## Keyboard Navigation

### DO ✅

```tsx
// Focus management in modal
function Modal({ isOpen, onClose, children }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Save current focus
      previousFocus.current = document.activeElement as HTMLElement;
      // Focus modal
      modalRef.current?.focus();
    } else {
      // Restore focus
      previousFocus.current?.focus();
    }
  }, [isOpen]);

  // Trap focus inside modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }

    if (e.key !== 'Tab') return;

    const focusable = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (!focusable?.length) return;

    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg p-6 max-w-md w-full"
      >
        {children}
      </div>
    </div>
  );
}

// Roving tabindex for lists/menus
function Menu({ items }: { items: MenuItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % items.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + items.length) % items.length);
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(items.length - 1);
        break;
    }
  };

  return (
    <ul role="menu" onKeyDown={handleKeyDown}>
      {items.map((item, index) => (
        <li
          key={item.id}
          role="menuitem"
          tabIndex={index === activeIndex ? 0 : -1}
          ref={(el) => index === activeIndex && el?.focus()}
        >
          {item.label}
        </li>
      ))}
    </ul>
  );
}
```

---

## Form Accessibility

### DO ✅

```tsx
function AccessibleForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <form aria-describedby="form-errors">
      {/* Error summary */}
      {Object.keys(errors).length > 0 && (
        <div
          id="form-errors"
          role="alert"
          className="bg-red-50 p-4 rounded mb-4"
        >
          <h2 className="font-medium text-red-800">Please fix the following:</h2>
          <ul className="list-disc pl-5 mt-2">
            {Object.entries(errors).map(([field, message]) => (
              <li key={field}>
                <a href={`#${field}`} className="text-red-600 underline">
                  {message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Field with error */}
      <div className="mb-4">
        <label htmlFor="email" className="block font-medium mb-1">
          Email <span aria-hidden="true">*</span>
          <span className="sr-only">(required)</span>
        </label>
        <input
          id="email"
          type="email"
          aria-required="true"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className={`w-full border rounded px-3 py-2 ${
            errors.email ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.email && (
          <p id="email-error" className="text-red-600 text-sm mt-1" role="alert">
            {errors.email}
          </p>
        )}
      </div>

      {/* Field with hint */}
      <div className="mb-4">
        <label htmlFor="password" className="block font-medium mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          aria-describedby="password-hint"
          className="w-full border rounded px-3 py-2"
        />
        <p id="password-hint" className="text-gray-500 text-sm mt-1">
          Must be at least 8 characters
        </p>
      </div>

      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
        Submit
      </button>
    </form>
  );
}
```

---

## Screen Reader Only

### DO ✅

```tsx
// Tailwind sr-only class (or equivalent)
// .sr-only {
//   position: absolute;
//   width: 1px;
//   height: 1px;
//   padding: 0;
//   margin: -1px;
//   overflow: hidden;
//   clip: rect(0, 0, 0, 0);
//   white-space: nowrap;
//   border: 0;
// }

// Provide context for screen readers
function ProductCard({ product }: { product: Product }) {
  return (
    <article aria-labelledby={`product-${product.id}`}>
      <img src={product.image} alt={product.name} />
      
      <h2 id={`product-${product.id}`}>{product.name}</h2>
      
      <p>
        <span className="sr-only">Price:</span>
        ${product.price}
      </p>
      
      <button aria-label={`Add ${product.name} to cart`}>
        Add to cart
      </button>
    </article>
  );
}

// Table with proper headers
function DataTable({ data }: { data: Item[] }) {
  return (
    <table>
      <caption className="sr-only">Product inventory</caption>
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Price</th>
          <th scope="col">Stock</th>
          <th scope="col"><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {data.map((item) => (
          <tr key={item.id}>
            <th scope="row">{item.name}</th>
            <td>${item.price}</td>
            <td>{item.stock}</td>
            <td>
              <button aria-label={`Edit ${item.name}`}>Edit</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## Focus Indicators

### DO ✅

```tsx
// Never remove focus outline without replacement
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      // Custom focus ring
    },
  },
};

// Good focus styles
function Button({ children, ...props }: ButtonProps) {
  return (
    <button
      className="px-4 py-2 bg-blue-600 text-white rounded
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      {...props}
    >
      {children}
    </button>
  );
}

// Focus visible only for keyboard users
function Link({ href, children }: LinkProps) {
  return (
    <a
      href={href}
      className="text-blue-600 underline
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {children}
    </a>
  );
}
```

### DON'T ❌

```tsx
// Never do this!
button:focus {
  outline: none;
}

// No visible focus indicator
<button className="focus:outline-none">{children}</button>
```

---

## Images & Media

### DO ✅

```tsx
// Informative image - describe content
<img
  src="/chart.png"
  alt="Sales chart showing 50% increase from January to March 2024"
/>

// Decorative image - empty alt
<img src="/decorative-border.png" alt="" role="presentation" />

// Complex image with description
function ComplexChart({ data }: { data: ChartData }) {
  return (
    <figure>
      <img
        src={data.imageUrl}
        alt="Quarterly sales comparison"
        aria-describedby="chart-desc"
      />
      <figcaption id="chart-desc">
        Q1: $100k, Q2: $150k, Q3: $200k, Q4: $180k. 
        Overall growth of 80% year-over-year.
      </figcaption>
    </figure>
  );
}

// Video with captions
function VideoPlayer({ src, captions }: VideoProps) {
  return (
    <video controls>
      <source src={src} type="video/mp4" />
      <track
        kind="captions"
        src={captions}
        srcLang="en"
        label="English"
        default
      />
      <p>
        Your browser doesn't support video.
        <a href={src}>Download the video</a>.
      </p>
    </video>
  );
}
```

---

## Loading States

### DO ✅

```tsx
function LoadingButton({ isLoading, children, ...props }: LoadingButtonProps) {
  return (
    <button
      disabled={isLoading}
      aria-busy={isLoading}
      aria-disabled={isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <Spinner aria-hidden="true" />
          <span className="sr-only">Loading...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

function DataLoader({ isLoading, children }: DataLoaderProps) {
  return (
    <div aria-busy={isLoading} aria-live="polite">
      {isLoading ? (
        <div role="status">
          <Spinner aria-hidden="true" />
          <span className="sr-only">Loading data...</span>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
```

---

## Color & Contrast

### DO ✅

```tsx
// Don't rely on color alone
function StatusBadge({ status }: { status: 'success' | 'error' | 'warning' }) {
  const config = {
    success: { icon: <CheckIcon />, label: 'Success', className: 'bg-green-100 text-green-800' },
    error: { icon: <XIcon />, label: 'Error', className: 'bg-red-100 text-red-800' },
    warning: { icon: <AlertIcon />, label: 'Warning', className: 'bg-yellow-100 text-yellow-800' },
  };

  const { icon, label, className } = config[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded ${className}`}>
      {icon}
      {label}
    </span>
  );
}

// Form errors - not just red text
function FieldError({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-1 text-red-600 text-sm mt-1" role="alert">
      <ErrorIcon aria-hidden="true" className="w-4 h-4" />
      {message}
    </p>
  );
}
```

---

## Testing Accessibility

### DO ✅

```tsx
// Using jest-axe
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('Button has no accessibility violations', async () => {
  const { container } = render(<Button>Click me</Button>);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});

// Testing keyboard navigation
test('Modal can be closed with Escape', async () => {
  const onClose = vi.fn();
  render(<Modal isOpen onClose={onClose}><p>Content</p></Modal>);
  
  await userEvent.keyboard('{Escape}');
  
  expect(onClose).toHaveBeenCalled();
});

// Testing screen reader text
test('Icon button has accessible name', () => {
  render(<IconButton icon={<TrashIcon />} label="Delete item" onClick={() => {}} />);
  
  expect(screen.getByRole('button', { name: 'Delete item' })).toBeInTheDocument();
});
```

---

## Quick Reference

| Attribute | Purpose |
|-----------|---------|
| `aria-label` | Label when no visible text |
| `aria-labelledby` | Reference visible label |
| `aria-describedby` | Additional description |
| `aria-live` | Announce dynamic changes |
| `aria-hidden` | Hide from screen readers |
| `aria-expanded` | Toggle state |
| `aria-current` | Current item in set |
| `role` | Override semantic role |

| Key | Expected Behavior |
|-----|-------------------|
| Tab | Move to next focusable |
| Shift+Tab | Move to previous |
| Enter/Space | Activate button |
| Escape | Close modal/menu |
| Arrow keys | Navigate within widget |

| WCAG Level | Requirements |
|------------|--------------|
| A | Minimum - keyboard, alt text |
| AA | Standard - contrast, resize |
| AAA | Enhanced - sign language |
