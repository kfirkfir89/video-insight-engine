# Performance Patterns

Code splitting, memoization, virtualization, CLS prevention, and bundle optimization.

<rules>
- ALWAYS lazy-load route components with `lazy()` + `<Suspense>` — keep main bundle under 100KB gzipped (causes slow initial load if everything eager-loaded)
- ALWAYS set explicit dimensions on images/videos/embeds (width/height or aspect-ratio) (causes Cumulative Layout Shift)
- ALWAYS use `transform` for panel/sidebar show/hide animations — never animate width/height/display (causes layout thrashing on every frame)
- ALWAYS virtualize lists over 100 items with @tanstack/react-virtual (causes rendering hundreds of DOM nodes)
- ALWAYS debounce search inputs and resize/scroll handlers (causes excessive API calls and main-thread blocking)
- NEVER memo/useCallback/useMemo without measuring a performance problem first (causes complexity overhead without benefit)
- NEVER pass inline objects or arrow functions as props to memoized children (breaks memoization, renders become no-ops)
</rules>

---

## Code Splitting

ALWAYS lazy-load non-critical routes. Keep home/landing eager.

```tsx
const Dashboard = lazy(() => import('./pages/Dashboard'));

function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route index element={<Home />} />
        <Route path="dashboard" element={<Dashboard />} />
      </Routes>
    </Suspense>
  );
}
```

Heavy libraries: load on demand with dynamic import, show skeleton until ready.

---

## Memoization Rules

| Tool | Use ONLY When |
|------|--------------|
| React.memo | Component re-renders frequently with same props (measured) |
| useCallback | Function passed to memoized child or in dependency array |
| useMemo | Expensive calculation (>1ms) or referential equality for context value |

NEVER: memo simple components, useCallback every handler, useMemo cheap computations.

---

## Virtualization

ALWAYS use for lists over 100 items. Use `@tanstack/react-virtual`.

```tsx
const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 50,
});
```

---

## Layout Stability (CLS)

ALWAYS reserve space before content loads.

```tsx
// Images: explicit dimensions
<img src={src} alt={alt} width={800} height={450} loading="lazy" />

// Embeds: aspect-ratio container
<div className="aspect-video w-full"><iframe src={url} className="w-full h-full" /></div>

// Skeletons: match final content size
<div className="h-[200px] rounded-lg animate-pulse bg-gray-200" />
```

---

## Panel Animations

ALWAYS use transform for sidebars/drawers. NEVER animate width or toggle display.

```tsx
<aside className={cn(
  'fixed top-0 left-0 h-full w-64 transition-transform duration-200',
  isOpen ? 'translate-x-0' : '-translate-x-full'
)} />
```

---

## Font Optimization

Use `font-display: swap`, woff2 only, subset when possible. Match fallback font metrics with `size-adjust`/`ascent-override` to prevent layout shift during font swap.

---

## Debouncing

```tsx
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
```

---

## Bundle Budget

| Target | Budget |
|--------|--------|
| Main bundle (gzipped) | < 100KB |
| Per-route chunk | < 50KB |
| Total initial load | < 200KB |

Measure with `npx vite-bundle-visualizer`.

---

## Edge Cases

- **Component splitting vs memo:** Prefer splitting components to isolate state changes over wrapping in React.memo. Smaller components naturally re-render less.
- **Forced synchronous layout:** Never read layout properties (offsetHeight, getBoundingClientRect) immediately after writing styles. Batch reads first, then writes in requestAnimationFrame.
- **content-visibility:** Use `content-visibility: auto` on off-screen sections for large pages. Reduces initial rendering cost.

---

## Rules Summary

Routes are lazy-loaded with Suspense, main bundle stays under 100KB gzipped. All images have explicit dimensions, panels animate with transform only, and skeletons match final content size to prevent CLS. Lists over 100 items are virtualized. Memoization requires measurement first — prefer component splitting over memo. Search inputs are debounced, fonts use swap+woff2, and layout reads/writes are batched. The goal is perceived performance through instant feedback and zero layout shift.
