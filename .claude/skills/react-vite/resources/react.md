# React Patterns

Component design, hooks, and composition patterns.

---

## Functional Components

### DO ✅

```tsx
// Named export, typed props
interface UserCardProps {
  user: User;
  onSelect?: (id: string) => void;
}

export function UserCard({ user, onSelect }: UserCardProps) {
  return (
    <div className="user-card" onClick={() => onSelect?.(user.id)}>
      <img src={user.avatar} alt={user.name} />
      <span>{user.name}</span>
    </div>
  );
}
```

### DON'T ❌

```tsx
// Anonymous default export, untyped
export default function({ user, onSelect }) {
  return (
    <div onClick={() => onSelect(user.id)}>
      {user.name}
    </div>
  );
}
```

---

## Custom Hooks

### DO ✅

```tsx
// Encapsulate logic in custom hooks
function useToggle(initial = false) {
  const [value, setValue] = useState(initial);
  
  const toggle = useCallback(() => setValue((v) => !v), []);
  const setTrue = useCallback(() => setValue(true), []);
  const setFalse = useCallback(() => setValue(false), []);
  
  return { value, toggle, setTrue, setFalse };
}

// Usage
function Modal() {
  const { value: isOpen, setTrue: open, setFalse: close } = useToggle();
  
  return (
    <>
      <button onClick={open}>Open</button>
      {isOpen && <Dialog onClose={close} />}
    </>
  );
}
```

### DON'T ❌

```tsx
// Logic scattered in component
function Modal() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open</button>
      {isOpen && <Dialog onClose={() => setIsOpen(false)} />}
    </>
  );
}
```

---

## Compound Components

### DO ✅

```tsx
// Parent provides context, children consume it
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
  if (!ctx) throw new Error('Option must be inside Select');
  
  return (
    <button
      className={ctx.value === value ? 'selected' : ''}
      onClick={() => ctx.onChange(value)}
    >
      {children}
    </button>
  );
}

Select.Option = Option;

// Usage - clean, composable API
<Select value={color} onChange={setColor}>
  <Select.Option value="red">Red</Select.Option>
  <Select.Option value="blue">Blue</Select.Option>
</Select>
```

---

## Render Props

### DO ✅

```tsx
// When children need data from parent
interface MouseTrackerProps {
  children: (position: { x: number; y: number }) => React.ReactNode;
}

function MouseTracker({ children }: MouseTrackerProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);
  
  return <>{children(position)}</>;
}

// Usage
<MouseTracker>
  {({ x, y }) => <div>Mouse: {x}, {y}</div>}
</MouseTracker>
```

---

## Controlled vs Uncontrolled

### Controlled (Recommended)

```tsx
// Parent owns the state
function ControlledInput({ value, onChange }: InputProps) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// Usage
const [name, setName] = useState('');
<ControlledInput value={name} onChange={setName} />
```

### Uncontrolled (When Needed)

```tsx
// Component owns its state, parent reads via ref
function UncontrolledInput({ defaultValue }: InputProps) {
  const ref = useRef<HTMLInputElement>(null);
  
  return <input ref={ref} defaultValue={defaultValue} />;
}

// Usage - read value imperatively
const inputRef = useRef<HTMLInputElement>(null);
const handleSubmit = () => console.log(inputRef.current?.value);
```

---

## Error Boundaries

### DO ✅

```tsx
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

// Usage - wrap feature boundaries
<ErrorBoundary FallbackComponent={ErrorFallback}>
  <UserProfile />
</ErrorBoundary>
```

---

## Refs

### DO ✅

```tsx
// DOM access
function AutoFocusInput() {
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  return <input ref={inputRef} />;
}

// Mutable value that doesn't trigger re-render
function useInterval(callback: () => void, delay: number) {
  const savedCallback = useRef(callback);
  
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);
  
  useEffect(() => {
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
```

### DON'T ❌

```tsx
// Using ref to store state that should trigger re-render
const countRef = useRef(0);
countRef.current++; // Won't re-render!
```

---

## forwardRef

### DO ✅

```tsx
// Forward ref to inner element
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', children, ...props }, ref) => {
    return (
      <button ref={ref} className={`btn btn-${variant}`} {...props}>
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

---

## useEffect Patterns

### DO ✅

```tsx
// Cleanup subscriptions
useEffect(() => {
  const subscription = api.subscribe(handleUpdate);
  return () => subscription.unsubscribe();
}, []);

// Fetch with abort
useEffect(() => {
  const controller = new AbortController();
  
  async function fetchData() {
    try {
      const res = await fetch(url, { signal: controller.signal });
      setData(await res.json());
    } catch (e) {
      if (e.name !== 'AbortError') setError(e);
    }
  }
  
  fetchData();
  return () => controller.abort();
}, [url]);
```

### DON'T ❌

```tsx
// Missing dependencies
useEffect(() => {
  fetchUser(userId); // userId not in deps!
}, []);

// No cleanup for subscriptions
useEffect(() => {
  window.addEventListener('resize', handler);
  // Missing cleanup!
}, []);
```

---

## Quick Reference

| Pattern | When to Use |
|---------|-------------|
| Custom Hook | Reusable stateful logic |
| Compound Component | Related components that share state |
| Render Props | Dynamic children based on parent data |
| forwardRef | Expose DOM ref from component |
| Error Boundary | Catch and handle component errors |

| Hook | Purpose |
|------|---------|
| useState | Local component state |
| useEffect | Side effects, subscriptions |
| useRef | DOM access, mutable values |
| useCallback | Stable function reference |
| useMemo | Expensive computations |
| useContext | Consume context value |
