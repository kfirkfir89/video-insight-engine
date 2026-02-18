# Performance Patterns

Optimization, lazy loading, and rendering best practices.

---

## Code Splitting

### DO ✅

```tsx
import { lazy, Suspense } from 'react';

// Lazy load route components
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const Analytics = lazy(() => import('./pages/Analytics'));

// Wrap with Suspense
function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/analytics" element={<Analytics />} />
      </Routes>
    </Suspense>
  );
}
```

### DON'T ❌

```tsx
// Import everything upfront
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Analytics from './pages/Analytics';
// Huge initial bundle!
```

---

## React.memo

### DO ✅

```tsx
// Memo for expensive components that re-render with same props
const ExpensiveList = memo(function ExpensiveList({ items }: ListProps) {
  return (
    <ul>
      {items.map((item) => (
        <ExpensiveItem key={item.id} item={item} />
      ))}
    </ul>
  );
});

// Custom comparison for complex props
const UserCard = memo(
  function UserCard({ user, onSelect }: UserCardProps) {
    return (/* ... */);
  },
  (prevProps, nextProps) => {
    return prevProps.user.id === nextProps.user.id;
  }
);
```

### DON'T ❌

```tsx
// Memo everything (overhead without benefit)
const Button = memo(({ children }) => <button>{children}</button>);

// Memo with inline objects/functions (breaks memoization)
<MemoizedComponent
  style={{ color: 'red' }}      // New object every render!
  onClick={() => doSomething()} // New function every render!
/>
```

---

## useCallback

### DO ✅

```tsx
// Stable reference for memoized children
function Parent() {
  const [count, setCount] = useState(0);

  // Stable reference - MemoizedChild won't re-render
  const handleClick = useCallback(() => {
    console.log('clicked');
  }, []);

  return (
    <>
      <p>{count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
      <MemoizedChild onClick={handleClick} />
    </>
  );
}

// For dependencies that change
const handleSelect = useCallback((id: string) => {
  onSelect(id);
  trackEvent('selected', id);
}, [onSelect, trackEvent]);
```

### DON'T ❌

```tsx
// useCallback everything
const handleClick = useCallback(() => {
  setOpen(true);
}, []); // Unnecessary if child isn't memoized
```

---

## useMemo

### DO ✅

```tsx
// Expensive computations
function FilteredList({ items, filter }: Props) {
  const filteredItems = useMemo(() => {
    return items.filter((item) =>
      item.name.toLowerCase().includes(filter.toLowerCase())
    );
  }, [items, filter]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      filtered: filteredItems.length,
      percentage: (filteredItems.length / items.length) * 100,
    };
  }, [items.length, filteredItems.length]);

  return (/* ... */);
}

// Stable object references for context
const contextValue = useMemo(
  () => ({ user, login, logout }),
  [user, login, logout]
);
```

### DON'T ❌

```tsx
// Simple calculations don't need memoization
const total = useMemo(() => items.length, [items]); // Just use items.length

// New objects that aren't used as dependencies
const config = useMemo(() => ({ theme: 'dark' }), []); // Only useful if passed to memoized component
```

---

## Virtualization

### DO ✅

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // Estimated row height
  });

  return (
    <div ref={parentRef} className="h-96 overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {items[virtualItem.index].name}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### DON'T ❌

```tsx
// Render 10,000 items without virtualization
{items.map((item) => <Item key={item.id} {...item} />)}
```

---

## Image Optimization

### DO ✅

```tsx
// Lazy load images
<img
  src={src}
  alt={alt}
  loading="lazy"
  decoding="async"
/>

// Responsive images
<img
  src={src}
  srcSet={`${src}?w=400 400w, ${src}?w=800 800w`}
  sizes="(max-width: 600px) 400px, 800px"
  alt={alt}
/>

// Placeholder while loading
function LazyImage({ src, alt }: ImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative">
      {!loaded && <div className="absolute inset-0 bg-gray-200 animate-pulse" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={loaded ? 'opacity-100' : 'opacity-0'}
      />
    </div>
  );
}
```

---

## Component Splitting

### DO ✅

```tsx
// Split to isolate re-renders
function Page() {
  return (
    <div>
      <Header />           {/* Static - rarely re-renders */}
      <SearchBar />        {/* Has own state - isolated */}
      <ProductList />      {/* Server data - isolated */}
      <Cart />             {/* Global state - isolated */}
    </div>
  );
}

// Instead of one big component with all the state
function BadPage() {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const { data: products } = useProducts();
  // Everything re-renders when any state changes!
}
```

---

## Debouncing & Throttling

### DO ✅

```tsx
// Debounce search input
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Usage
function SearchInput() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  // Only fetch when debounced value changes
  const { data } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => api.search(debouncedQuery),
    enabled: debouncedQuery.length > 2,
  });

  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
```

---

## Bundle Analysis

### DO ✅

```bash
# Install analyzer
npm install -D rollup-plugin-visualizer

# vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({ open: true }),
  ],
});

# Build and analyze
npm run build
```

---

## Quick Reference

| Optimization | When to Use |
|--------------|-------------|
| React.memo | Component re-renders with same props frequently |
| useCallback | Function passed to memoized child |
| useMemo | Expensive calculation, referential equality |
| lazy/Suspense | Route-level code splitting |
| Virtualization | Lists > 100 items |
| Debounce | Search inputs, API calls on type |

| Anti-Pattern | Problem |
|--------------|---------|
| Memo everything | Overhead without benefit |
| Inline objects in props | Breaks memoization |
| useEffect for derived state | Extra re-renders |
| Huge component tree | Everything re-renders together |

---

## Layout Stability (CLS Prevention)

Content Layout Shift ruins perceived performance. Reserve space before content loads.

### DO ✅

```tsx
// Always set dimensions on images
<img src={src} alt={alt} width={800} height={450} loading="lazy" />

// Use aspect-ratio for responsive containers
<div className="aspect-video w-full">
  <iframe src={embedUrl} className="w-full h-full" />
</div>

// Skeleton that matches final layout size
function CardSkeleton() {
  return (
    <div className="h-[200px] rounded-lg animate-pulse bg-gray-200" />
  );
}
```

### DON'T ❌

```tsx
// No dimensions — shifts layout when image loads
<img src={src} alt={alt} />

// No min-height — content jumps when data arrives
<div>{isLoading ? <Spinner /> : <LargeContent />}</div>
```

---

## Transform-Based Panel Animations

Sidebars, drawers, and panels must stay in document flow. Toggle visibility with `transform`, never by animating `width` or toggling `display`.

### DO ✅

```tsx
// Sidebar always in DOM, slides with transform
function Sidebar({ isOpen }: { isOpen: boolean }) {
  return (
    <aside
      className={cn(
        'fixed top-0 left-0 h-full w-64 transition-transform duration-200',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* content */}
    </aside>
  );
}
```

### DON'T ❌

```tsx
// Animating width — triggers layout on every frame
<aside style={{ width: isOpen ? 256 : 0, transition: 'width 0.2s' }} />

// display: none — element removed from flow, causes layout shift
{isOpen && <aside>...</aside>}
```

---

## Avoiding Forced Synchronous Layout

Never read layout properties immediately after writing styles in the same frame.

### DO ✅

```tsx
// Batch reads and writes separately
function animateElement(el: HTMLElement) {
  // READ first
  const currentHeight = el.offsetHeight;

  // WRITE after
  requestAnimationFrame(() => {
    el.style.height = `${currentHeight + 100}px`;
  });
}
```

### DON'T ❌

```tsx
// Read-write-read-write thrashing
elements.forEach(el => {
  el.style.width = '100px';      // WRITE
  const h = el.offsetHeight;     // READ — forces layout!
  el.style.height = `${h}px`;   // WRITE
});
```

---

## Font Optimization

Fonts are one of the largest sources of layout shift and slow LCP.

### DO ✅

```css
/* Use font-display: swap and woff2 only */
@font-face {
  font-family: 'CustomFont';
  src: url('/fonts/custom.woff2') format('woff2');
  font-display: swap;
  unicode-range: U+0000-00FF; /* Subset to Latin if possible */
}

/* Match fallback metrics to prevent layout shift */
@font-face {
  font-family: 'CustomFont Fallback';
  src: local('Arial');
  size-adjust: 105%;
  ascent-override: 95%;
  descent-override: 22%;
  line-gap-override: 0%;
}
```

### DON'T ❌

```css
/* Loading full font file, blocks rendering */
@font-face {
  font-family: 'CustomFont';
  src: url('/fonts/custom.ttf');  /* ttf is larger than woff2 */
  font-display: block;           /* Invisible text until loaded */
}
```

---

## Critical Asset Preloading

Preload above-the-fold resources to improve LCP.

### DO ✅

```html
<!-- In <head> — preload critical assets -->
<link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin />
<link rel="preload" href="/hero.webp" as="image" />
```

```tsx
// Inline critical CSS, async-load the rest
<style>{criticalCSS}</style>
<link rel="stylesheet" href="/styles.css" media="print" onLoad="this.media='all'" />
```

---

## Bundle Budget

Keep the main JS bundle under 100KB gzipped. Split everything else.

### DO ✅

```tsx
// Route-level code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

// Heavy libraries loaded on demand
const loadChartLib = () => import('chart-library');

function ChartSection() {
  const [Chart, setChart] = useState(null);

  useEffect(() => {
    loadChartLib().then(mod => setChart(() => mod.default));
  }, []);

  return Chart ? <Chart data={data} /> : <Skeleton />;
}
```

### Measurement

```bash
# Analyze bundle composition
npx vite-bundle-visualizer
# or
npx source-map-explorer dist/assets/*.js
```

| Target | Budget |
|--------|--------|
| Main bundle (gzipped) | < 100KB |
| Per-route chunk | < 50KB |
| Total initial load | < 200KB |
| Largest dependency | Flag if > 30KB |
