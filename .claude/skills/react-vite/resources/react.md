# React Patterns

Component design, hooks, composition, and React 19 features.

<rules>
- ALWAYS use named function declarations with typed props interfaces (causes poor DX if anonymous/untyped)
- ALWAYS extract reusable logic into custom hooks — components should compose hooks, not contain raw useEffect/useState chains (causes untestable, duplicated logic)
- ALWAYS use compound components for complex UI with shared state (causes prop explosion if using config objects)
- ALWAYS call hooks unconditionally at the top level — never inside conditions or loops (breaks Rules of Hooks)
- ALWAYS clean up subscriptions and event listeners in useEffect return (causes memory leaks)
- NEVER use class components — function components only (causes React 19 incompatibility)
- NEVER store derived state in useState — compute during render (causes sync bugs and extra re-renders)
</rules>

---

## Functional Components

ALWAYS use named exports with typed props. Never anonymous default exports.

```tsx
interface UserCardProps {
  user: User;
  onSelect?: (id: string) => void;
}

export function UserCard({ user, onSelect }: UserCardProps) {
  return (
    <div onClick={() => onSelect?.(user.id)}>
      <img src={user.avatar} alt={user.name} />
      <span>{user.name}</span>
    </div>
  );
}
```

---

## Custom Hooks

ALWAYS encapsulate reusable stateful logic in hooks. Name them `use*`.

```tsx
function useToggle(initial = false) {
  const [value, setValue] = useState(initial);
  const toggle = useCallback(() => setValue((v) => !v), []);
  const setTrue = useCallback(() => setValue(true), []);
  const setFalse = useCallback(() => setValue(false), []);
  return { value, toggle, setTrue, setFalse };
}
```

---

## Compound Components

ALWAYS use for related components sharing state. Parent provides context, children consume.

```tsx
const SelectContext = createContext<SelectContextType | null>(null);

function Select({ children, value, onChange }: SelectProps) {
  return (
    <SelectContext.Provider value={{ value, onChange }}>
      <div className="select">{children}</div>
    </SelectContext.Provider>
  );
}

function Option({ value, children }: OptionProps) {
  const ctx = useContext(SelectContext);
  if (!ctx) throw new Error("Option must be inside Select");
  return (
    <button
      className={ctx.value === value ? "selected" : ""}
      onClick={() => ctx.onChange(value)}
    >
      {children}
    </button>
  );
}
Select.Option = Option;
```

---

## Error Boundaries

ALWAYS wrap every major section (sidebar, header, main content). One broken component must not crash the page.

```tsx
import { ErrorBoundary } from "react-error-boundary";

function App() {
  return (
    <div className="flex">
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <Sidebar />
      </ErrorBoundary>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <MainContent />
      </ErrorBoundary>
    </div>
  );
}
```

Boundary levels: route-level (prevents blank page), feature-level (sidebar crash doesn't break content), widget-level (card failure shows fallback). ALWAYS log errors via `onError` prop to error tracking.

---

## useEffect Patterns

ALWAYS include cleanup. ALWAYS include correct dependencies.

```tsx
// Fetch with abort
useEffect(() => {
  const controller = new AbortController();
  async function fetchData() {
    try {
      const res = await fetch(url, { signal: controller.signal });
      setData(await res.json());
    } catch (e) {
      if (e.name !== "AbortError") setError(e);
    }
  }
  fetchData();
  return () => controller.abort();
}, [url]);
```

NEVER use useEffect to set derived state. NEVER omit dependencies. NEVER forget cleanup for subscriptions.

---

## forwardRef

ALWAYS use when exposing DOM refs from wrapper components. Set `displayName`.

```tsx
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", children, ...props }, ref) => (
    <button ref={ref} className={`btn btn-${variant}`} {...props}>
      {children}
    </button>
  ),
);
Button.displayName = "Button";
```

---

## React 19 Hooks

**useActionState** — Track form action lifecycle (pending, success, error). Use for form submissions with server actions.

**use()** — Read promises (suspends until resolved) or context conditionally. Wrap consumers in `<Suspense>`.

**useOptimistic** — Show immediate UI feedback before async completes. Pair with `useTransition`.

**useFormStatus** — Access form pending state from submit buttons inside a `<form>`. Must be used inside a form child component.

| Hook             | Use Case                                         |
| ---------------- | ------------------------------------------------ |
| `useActionState` | Form submissions, need state + pending           |
| `use()`          | Read promises with Suspense, conditional context |
| `useOptimistic`  | Immediate feedback before async completes        |
| `useFormStatus`  | Submit buttons aware of form state               |

---

## Feature Module Exports

ALWAYS use a barrel `index.ts` that exports only the public API of a feature.

```tsx
// src/features/users/index.ts
export { UsersPage } from "./pages/UsersPage";
export { UserCard } from "./components/UserCard";
export { useUsers, useUser } from "./hooks/useUsers";
export type { User, CreateUserData } from "./types";
```

---

## Edge Cases

- **Render props vs hooks:** Prefer hooks for data sharing. Use render props only when children need dynamic data from a parent that tracks external state (e.g., mouse position tracker).
- **Refs for mutable values:** Use `useRef` for values that change but should NOT trigger re-renders (interval IDs, previous values). If it should trigger re-render, use `useState`.
- **Controlled vs uncontrolled:** Default to controlled inputs. Use uncontrolled only for performance-critical forms or when integrating third-party libraries that manage their own state.

---

## Rules Summary

Use named function components with typed props, extract logic into custom hooks, and compose with compound components and children — never config objects. Every major section gets an ErrorBoundary. All hooks are called unconditionally at the top level, all effects include cleanup and correct dependencies, and derived state is computed during render. Use React 19 hooks (useActionState, use, useOptimistic, useFormStatus) for form actions and optimistic updates. Never use class components, anonymous exports, conditional hooks, or useState for derived values.
