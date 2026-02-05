---
name: react-vite
description: Frontend engineering principles for React/Vite/TypeScript with shadcn/ui and Tailwind v4. How to think about UI architecture, not just what to build.
version: 3.1.0
updated: 2026-02-01
---

# Frontend Engineering Guidelines (React)

This skill teaches you to THINK like a principal frontend engineer, not just copy patterns.

---

## Tech Stack

| Technology      | Version | Purpose                    |
| --------------- | ------- | -------------------------- |
| React           | 19.x    | UI framework               |
| Vite            | 6.x     | Build tool                 |
| TypeScript      | 5.x     | Type safety                |
| Tailwind CSS    | 4.x     | Styling (CSS-first config) |
| shadcn/ui       | latest  | Component primitives       |
| React Router    | 7.x     | Routing                    |
| React Query     | 5.x     | Server state               |
| Zustand         | 5.x     | Client state               |
| React Hook Form | 7.x     | Forms                      |
| Zod             | 3.x     | Validation                 |

---

## The Principal Frontend Engineer Mindset

Before writing any component, ask yourself:

1. **What is the single responsibility of this component?** Not "render user profile" but "display user avatar and name" vs "handle profile editing form"

2. **Where does this state belong?** Local state? Lifted state? Context? Server state? The answer determines your architecture.

3. **Will this component be reused?** If yes, make it generic. If no, keep it specific. Don't over-engineer.

4. **What happens when things go wrong?** Loading states, error states, empty states. Users experience all of them.

5. **Can I test this in isolation?** If a component needs the entire app to test, it's too coupled.

---

## Core Principles (Frontend Perspective)

### SOLID for React

**Single Responsibility**

> "A component should have only one reason to change"

WHY: When a component handles too much, every change risks breaking something else.

```
❌ UserProfile handles: fetching data, form validation, avatar upload, settings
   → Change API? Touch UserProfile
   → Change form fields? Touch UserProfile
   → Everything entangled

✅ UserAvatar, UserForm, UserSettings, useUserData hook
   → Each changes for ONE reason
   → Easy to test, easy to reuse
```

**Open/Closed**

> "Open for extension, closed for modification"

WHY: Adding features shouldn't require changing existing components.

```
❌ Button component with if-statements for each variant
   if (variant === 'primary') ... else if (variant === 'danger') ...
   → New variant = modify Button

✅ Button accepts className, children, composition
   → New variant = new styles, Button unchanged
   → Compound components for complex cases
```

**Dependency Inversion**

> "Depend on abstractions, not concretions"

WHY: Components shouldn't know where their data comes from.

```
❌ UserList imports fetch() and calls API directly
   → Can't test without mocking fetch
   → Can't reuse with different data source

✅ UserList receives users as props or via custom hook
   → Test with mock data
   → Works with REST, GraphQL, local state
```

---

### Component Composition Over Inheritance

React doesn't use inheritance. It uses **composition**.

```
❌ Trying to extend components
   class AdminButton extends Button { ... }

✅ Compose components
   <Button variant="danger" icon={<TrashIcon />}>Delete</Button>

✅ Use render props or children
   <DataFetcher render={(data) => <UserList users={data} />} />

✅ Use compound components
   <Select>
     <Select.Option value="a">Option A</Select.Option>
     <Select.Option value="b">Option B</Select.Option>
   </Select>
```

---

### DRY - But Not Too DRY

> "Every piece of knowledge must have a single, unambiguous representation"

**BUT: Wrong abstraction is worse than duplication.**

```
❌ Premature DRY
   Two forms have similar fields, so you make a "generic" form
   Later, they diverge
   Now GenericForm has props for every edge case
   Worse than two separate forms

✅ Wait for the pattern
   See the same component 3 times?
   NOW extract it
   You understand the real abstraction
```

**Rule of Three:** Duplicate once is okay. Duplicate twice, consider abstracting. Duplicate three times, definitely abstract.

---

### KISS - Simplicity Wins

> "Keep it simple, stupid"

WHY: Clever code becomes debugging nightmares. Junior devs need to understand it.

```tsx
// ❌ Clever - what does this even do?
const result = data?.items
  ?.filter(Boolean)
  .reduce((a, b) => ({ ...a, [b.id]: b }), {});

// ✅ Simple - clear intent
const itemsById: Record<string, Item> = {};
for (const item of data?.items ?? []) {
  if (item) {
    itemsById[item.id] = item;
  }
}
```

**Signs you're being too clever:**

- You need comments to explain what it does
- You're proud of how short it is
- A colleague asks "what does this do?"
- You used more than 2 array methods chained

---

### YAGNI - Resist the Future

> "You aren't gonna need it"

WHY: Features you build "just in case" become code you maintain forever.

```
❌ "We might need dark mode later"
   → Complex theme system before any user asked
   → Maintenance burden forever

✅ Build what's needed now
   → Add dark mode when it's actually needed
   → You'll understand the requirements better then
```

---

## Separation of Concerns

### The Frontend Golden Rule

**Separate: UI, Logic, Data, Styling**

```
┌─────────────────────────────────────────┐
│            Pages/Routes                  │  Composition, layout
├─────────────────────────────────────────┤
│         Feature Components               │  Business logic, state
├─────────────────────────────────────────┤
│           UI Components                  │  Pure presentation
├─────────────────────────────────────────┤
│         Hooks / Services                 │  Data fetching, logic
└─────────────────────────────────────────┘
```

### Container vs Presentational

```
Container (Smart)           Presentational (Dumb)
─────────────────           ────────────────────
• Fetches data              • Receives props
• Manages state             • Renders UI
• Handles events            • Calls prop callbacks
• Knows about context       • No side effects
• Usually not reusable      • Highly reusable
```

### DO ✅

```
• UI components receive data via props
• Custom hooks handle data fetching
• Event handlers passed as props
• Styles co-located or in design system
• Business logic in hooks, not components
```

### DON'T ❌

```
• Fetch data inside UI components
• Put business logic in onClick handlers
• Mix styling approaches randomly
• Create god components that do everything
• Import API clients directly in components
```

---

## State Management Philosophy

### Where Does State Belong?

Ask these questions in order:

1. **Can it be derived?** → Don't store it, compute it
2. **Does only one component need it?** → Local state (useState)
3. **Do parent and children need it?** → Lift state up
4. **Do siblings need it?** → Lift to common parent
5. **Do distant components need it?** → Context or state library
6. **Does it come from the server?** → React Query/SWR (server state)

### State Categories

| Type         | Example                  | Solution                   |
| ------------ | ------------------------ | -------------------------- |
| UI State     | Modal open, tab active   | useState                   |
| Form State   | Input values, validation | React Hook Form / useState |
| Server State | User data, posts         | React Query, SWR           |
| URL State    | Filters, pagination      | URL params                 |
| Global UI    | Theme, sidebar           | Context                    |
| Global App   | Auth, cart               | Zustand, Context           |

### DO ✅

```
• Derive state when possible (computed values)
• Keep server state separate from UI state
• Use URL for shareable state (filters, pagination)
• Colocate state with components that use it
```

### DON'T ❌

```
• Put everything in global state
• Duplicate server data in local state
• Store derived values
• Use Redux for everything
```

---

## Component Design Principles

### Props Interface Design

```
❌ Boolean props explosion
   <Button primary secondary danger outline small large />

✅ Discriminated unions
   <Button variant="primary" size="lg" />

❌ Too many props (> 5-7 is a smell)
   <Card title desc image link onClick hover shadow border ... />

✅ Composition
   <Card>
     <Card.Image src={img} />
     <Card.Title>{title}</Card.Title>
     <Card.Action onClick={onClick}>Learn More</Card.Action>
   </Card>
```

### Children Over Config

```tsx
// ❌ Config objects
<List
  items={users}
  renderItem={(user) => <span>{user.name}</span>}
  renderEmpty={() => <p>No users</p>}
/>

// ✅ Children composition
<List>
  {users.length === 0 ? (
    <EmptyState>No users</EmptyState>
  ) : (
    users.map(user => <ListItem key={user.id}>{user.name}</ListItem>)
  )}
</List>
```

---

## Performance Mindset

### Render Optimization Rules

1. **Don't optimize prematurely** - Measure first
2. **Component splits > memo** - Smaller components re-render less
3. **State placement matters** - State changes re-render that component and children
4. **Stable references** - useCallback/useMemo for referential equality

### When to Use memo/useCallback/useMemo

| Optimization | When to Use                                              |
| ------------ | -------------------------------------------------------- |
| React.memo   | Component re-renders with same props frequently          |
| useCallback  | Function passed to memoized child or in dependency array |
| useMemo      | Expensive calculation, referential equality needed       |

### DO ✅

```
• Split components to isolate state
• Use React Query for server state (automatic caching)
• Lazy load routes and heavy components
• Virtualize long lists
```

### DON'T ❌

```
• Wrap everything in memo
• useCallback every function
• Store computed values in state
• Ignore React DevTools profiler
```

---

## Folder Structure

### Feature-Based (Recommended)

```
src/
├── features/
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── api/
│   │   └── index.ts
│   ├── users/
│   └── dashboard/
├── components/          # Shared UI components
│   ├── Button/
│   ├── Input/
│   └── Modal/
├── hooks/               # Shared hooks
├── lib/                 # Utilities, API client
├── pages/               # Route components (if not in features)
└── App.tsx
```

**Why:** Everything for a feature is together. Easy to find, easy to delete.

### The Delete Test

Can you delete a feature by deleting one folder? If yes, you're organized right.

---

## TypeScript First

### DO ✅

```typescript
// Type all props
interface ButtonProps {
  variant: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  onClick?: () => void;
}

// Use discriminated unions for complex state
type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

// Infer types when possible
const [count, setCount] = useState(0); // inferred as number
```

### DON'T ❌

```typescript
// any everywhere
const handleClick = (e: any) => { ... }

// Overly complex generics
type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T;

// Props spreading without types
function Button(props) { ... }  // No types!
```

---

## Quick Decision Guide

### Should I Create a New Component?

- [ ] Used in 2+ places? → YES
- [ ] > 50 lines of JSX? → Probably YES
- [ ] Has its own state/logic? → YES
- [ ] Just a div with className? → NO

### Should I Use Context?

- [ ] State needed by many distant components? → YES
- [ ] Prop drilling > 2 levels? → Consider it
- [ ] State changes frequently? → NO (use state library)
- [ ] Just 2-3 components need it? → Lift state instead

### Should I Memoize?

- [ ] Measured a performance problem? → Maybe YES
- [ ] "It might be slow someday"? → NO
- [ ] Large list with complex items? → Consider virtualization first

---

## Common Anti-Patterns to Avoid

### Component Anti-Patterns

```tsx
// ❌ ANTI-PATTERN: God Component
// One component doing everything - fetching, state, UI, business logic
function UserDashboard() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetching 3 different things
    fetch("/api/user")
      .then((r) => r.json())
      .then(setUser);
    fetch("/api/orders")
      .then((r) => r.json())
      .then(setOrders);
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings);
  }, []);

  // 500 lines of mixed concerns...
}

// ✅ FIX: Split into focused components with custom hooks
function UserDashboard() {
  return (
    <DashboardLayout>
      <UserProfile />
      <OrdersList />
      <SettingsPanel />
    </DashboardLayout>
  );
}
```

### State Anti-Patterns

```tsx
// ❌ ANTI-PATTERN: Storing derived state
const [items, setItems] = useState([]);
const [filteredItems, setFilteredItems] = useState([]); // WRONG!
const [itemCount, setItemCount] = useState(0); // WRONG!

useEffect(() => {
  setFilteredItems(items.filter((i) => i.active));
  setItemCount(items.length);
}, [items]);

// ✅ FIX: Derive during render
const [items, setItems] = useState([]);
const filteredItems = items.filter((i) => i.active); // Computed
const itemCount = items.length; // Computed
```

```tsx
// ❌ ANTI-PATTERN: Copying server data to local state
const { data: user } = useQuery(["user"], fetchUser);
const [localUser, setLocalUser] = useState(null);

useEffect(() => {
  if (user) setLocalUser(user); // WHY? Now you have stale copy!
}, [user]);

// ✅ FIX: Use server state directly
const { data: user } = useQuery(["user"], fetchUser);
// Just use `user` - React Query handles caching
```

### Hook Anti-Patterns

```tsx
// ❌ ANTI-PATTERN: Conditional hooks
function Profile({ userId }) {
  if (!userId) return null;
  const user = useUser(userId); // BREAKS RULES OF HOOKS!
}

// ✅ FIX: Always call hooks, handle condition in hook or after
function Profile({ userId }) {
  const user = useUser(userId); // Hook handles null internally
  if (!userId || !user) return null;
}
```

```tsx
// ❌ ANTI-PATTERN: useEffect for everything
useEffect(() => {
  setFullName(`${firstName} ${lastName}`); // Derived state!
}, [firstName, lastName]);

useEffect(() => {
  onSubmit(formData); // Event handler!
}, [formData]);

// ✅ FIX: Derive in render, use event handlers
const fullName = `${firstName} ${lastName}`;
const handleSubmit = () => onSubmit(formData);
```

### Performance Anti-Patterns

```tsx
// ❌ ANTI-PATTERN: Premature memoization
const MemoizedButton = memo(Button); // Used once, simple props
const handleClick = useCallback(() => onClick(), [onClick]); // Not passed to memoized child
const value = useMemo(() => a + b, [a, b]); // Simple computation

// ✅ FIX: Only memoize when you've measured a problem
const handleClick = () => onClick(); // Fine for most cases
const value = a + b; // Just compute it
```

```tsx
// ❌ ANTI-PATTERN: Inline objects in props
<Component style={{ margin: 10 }} /> // New object every render!
<Component config={{ theme: 'dark' }} /> // New object every render!

// ✅ FIX: Stable references
const style = useMemo(() => ({ margin: 10 }), []);
// OR define outside component if truly static
const CONFIG = { theme: 'dark' };
```

### TypeScript Anti-Patterns

```tsx
// ❌ ANTI-PATTERN: any as escape hatch
const handleEvent = (e: any) => { ... }
const data = response as any;

// ✅ FIX: Proper types
const handleEvent = (e: React.MouseEvent<HTMLButtonElement>) => { ... }
const data = response as UserResponse;
```

```tsx
// ❌ ANTI-PATTERN: Optional everything
interface Props {
  user?: User;
  onSave?: () => void;
  title?: string;
  // Everything optional = nothing is required = bugs
}

// ✅ FIX: Required by default, optional only when truly optional
interface Props {
  user: User;
  onSave: () => void;
  title?: string; // Only this is actually optional
}
```

---

## Related Resources

When working on specific topics, these resources work together:

| Topic            | Primary                                          | Also Read                                                                      |
| ---------------- | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| State Management | [state.md](resources/state.md)                   | [forms.md](resources/forms.md), [performance.md](resources/performance.md)     |
| Forms            | [forms.md](resources/forms.md)                   | [state.md](resources/state.md), [accessibility.md](resources/accessibility.md) |
| AI/Chat Features | [ai-integration.md](resources/ai-integration.md) | [state.md](resources/state.md), [performance.md](resources/performance.md)     |
| Styling          | [styling.md](resources/styling.md)               | [accessibility.md](resources/accessibility.md)                                 |
| Testing          | [testing.md](resources/testing.md)               | [react.md](resources/react.md)                                                 |

---

## Resource Files

For implementation details on specific technologies:

| Need to...                                     | Read this                                              |
| ---------------------------------------------- | ------------------------------------------------------ |
| Write components, hooks, patterns              | [react.md](resources/react.md)                         |
| Manage state, forms, server data               | [state.md](resources/state.md)                         |
| Generic CSS architecture and design principles | [styling.md](resources/styling.md)                     |
| Tailwind best practices                        | [tailwind.md](resources/tailwind.md)                   |
| Use Lucide icons correctly (Tailwind, a11y)    | [lucide.md](resources/lucide.md)                       |
| Optimize performance, lazy load                | [performance.md](resources/performance.md)             |
| Handle routing, navigation                     | [routing.md](resources/routing.md)                     |
| Write tests, mock data                         | [testing.md](resources/testing.md)                     |
| Handle forms, validation                       | [forms.md](resources/forms.md)                         |
| Integrate AI/LLM (Vercel AI SDK)               | [ai-integration.md](resources/ai-integration.md)       |
| Secure your app (XSS, tokens, CSRF)            | [security.md](resources/security.md)                   |
| Build accessible UIs (ARIA, keyboard)          | [accessibility.md](resources/accessibility.md)         |
| Internationalize your app (i18n)               | [i18n.md](resources/i18n.md)                           |
| See full working examples                      | [complete-examples.md](resources/complete-examples.md) |

---

## Project-Specific Documentation

For THIS project's specifics, see the docs/ folder:

| Need                | Reference                                               |
| ------------------- | ------------------------------------------------------- |
| System architecture | [docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md)   |
| Frontend guide      | [docs/FRONTEND.md](../../../docs/FRONTEND.md)           |
| API integration     | [docs/API-REFERENCE.md](../../../docs/API-REFERENCE.md) |
