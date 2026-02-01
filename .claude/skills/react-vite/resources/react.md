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

## React 19 Hooks

React 19 introduces new hooks for actions, optimistic updates, and async operations.

### useActionState

Tracks the lifecycle of form actions (pending, success, error).

```tsx
import { useActionState } from "react";

function LoginForm() {
  const [state, submitAction, isPending] = useActionState(
    async (previousState, formData: FormData) => {
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;

      try {
        await loginUser(email, password);
        return { success: true, error: null };
      } catch (error) {
        return { success: false, error: "Invalid credentials" };
      }
    },
    { success: false, error: null }
  );

  return (
    <form action={submitAction}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />

      {state.error && <p className="text-red-500">{state.error}</p>}

      <button type="submit" disabled={isPending}>
        {isPending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
```

### use() Hook

Read promises and context directly in components (suspends until resolved).

```tsx
import { use, Suspense } from "react";

// With Promises - component suspends until resolved
function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise);

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}

// Usage - wrap in Suspense
function App() {
  const userPromise = fetchUser(userId);

  return (
    <Suspense fallback={<UserSkeleton />}>
      <UserProfile userPromise={userPromise} />
    </Suspense>
  );
}

// With Context - can be called conditionally
function ThemedButton({ showTheme }: { showTheme: boolean }) {
  if (showTheme) {
    const theme = use(ThemeContext);
    return <button className={theme.buttonClass}>Themed</button>;
  }
  return <button>Default</button>;
}
```

### useOptimistic

Built-in optimistic updates without external libraries.

```tsx
import { useOptimistic, useTransition } from "react";

function LikeButton({ postId, likes }: { postId: string; likes: number }) {
  const [isPending, startTransition] = useTransition();
  const [optimisticLikes, addOptimisticLike] = useOptimistic(
    likes,
    (currentLikes, increment: number) => currentLikes + increment
  );

  const handleLike = () => {
    startTransition(async () => {
      addOptimisticLike(1);
      await likePost(postId);
    });
  };

  return (
    <button onClick={handleLike} disabled={isPending}>
      {optimisticLikes} likes
    </button>
  );
}

// With array state
function TodoList({ todos }: { todos: Todo[] }) {
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (state, newTodo: Todo) => [...state, { ...newTodo, pending: true }]
  );

  const addTodo = async (text: string) => {
    const newTodo = { id: crypto.randomUUID(), text, pending: false };
    addOptimisticTodo(newTodo);
    await createTodo(newTodo);
  };

  return (
    <ul>
      {optimisticTodos.map((todo) => (
        <li key={todo.id} className={todo.pending ? "opacity-50" : ""}>
          {todo.text}
        </li>
      ))}
    </ul>
  );
}
```

### useFormStatus

Access form submission status from within form components.

```tsx
import { useFormStatus } from "react-dom";

// Must be used inside a <form>
function SubmitButton() {
  const { pending, data, method, action } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? "Submitting..." : "Submit"}
    </button>
  );
}

// Usage
function ContactForm() {
  async function submitForm(formData: FormData) {
    "use server";
    await saveContact(formData);
  }

  return (
    <form action={submitForm}>
      <input name="name" required />
      <input name="email" type="email" required />
      <SubmitButton />
    </form>
  );
}
```

### When to Use Each Hook

| Hook | Use Case |
|------|----------|
| `useActionState` | Form submissions with server actions, need state + pending |
| `use()` | Read promises (with Suspense) or context conditionally |
| `useOptimistic` | Show immediate feedback before async completes |
| `useFormStatus` | Submit buttons that need to know form state |

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
| useActionState | Form action lifecycle (React 19) |
| use | Read promises/context (React 19) |
| useOptimistic | Optimistic updates (React 19) |
| useFormStatus | Form submission status (React 19) |
