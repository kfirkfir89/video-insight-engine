# State Management

Local state, context, server state (React Query), global state (Zustand), and URL state patterns.

<rules>
- ALWAYS use React Query for server data — never useState+useEffect for fetching (causes stale data, race conditions, no caching)
- ALWAYS derive computed values during render — never store in useState and sync with useEffect (causes sync bugs and double renders)
- ALWAYS use Zustand selectors to pick specific state slices — never select entire store (causes unnecessary re-renders on every update)
- ALWAYS create typed context with null default and a custom hook that throws if used outside provider (causes silent undefined errors)
- NEVER put frequently-changing values in Context — use Zustand or component-local state (causes re-render cascade to all consumers)
- NEVER duplicate server data into local state — use React Query's cache directly (causes stale copies)
- NEVER mutate state directly — always use immutable updates with spread or functional setState (causes missed re-renders)
</rules>

---

## State Decision Flow

Ask in order: (1) Can it be derived? Compute it. (2) One component? `useState`. (3) Parent+children? Lift state. (4) Siblings? Common parent. (5) Distant components? Context or Zustand. (6) From server? React Query.

| Type         | Example                  | Solution           |
| ------------ | ------------------------ | ------------------ |
| UI State     | Modal open, tab active   | useState           |
| Form State   | Input values, validation | Controlled useState + Zod (see forms.md) |
| Server State | User data, posts         | React Query        |
| URL State    | Filters, pagination      | useSearchParams    |
| Global UI    | Theme, sidebar toggle    | Context or Zustand |
| Global App   | Auth, cart               | Zustand            |

---

## React Query (Server State)

ALWAYS use query key factories. ALWAYS invalidate related queries on mutation success.

```tsx
export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (filters: UsersFilter) => [...userKeys.lists(), filters] as const,
  detail: (id: string) => [...userKeys.all, "detail", id] as const,
};

export function useUsers(filters: UsersFilter = {}) {
  return useQuery({
    queryKey: userKeys.list(filters),
    queryFn: () => api.getUsers(filters),
    staleTime: 5 * 60 * 1000,
  });
}
```

---

## Zustand (Global State)

ALWAYS use selectors. ALWAYS define actions inside the store.

```tsx
const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
  removeItem: (id) =>
    set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  total: () => get().items.reduce((sum, i) => sum + i.price, 0),
}));

// ALWAYS select specific slices
const count = useCartStore((s) => s.items.length);
```

---

## Context

ALWAYS use typed context with null default. ALWAYS throw in custom hook if used outside provider.

```tsx
const AuthContext = createContext<AuthContextType | null>(null);

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
```

---

## URL State

ALWAYS use `useSearchParams` for filters, pagination, and any state that should be shareable via URL.

```tsx
const [searchParams, setSearchParams] = useSearchParams();
const page = Number(searchParams.get("page")) || 1;

const setPage = (p: number) => {
  setSearchParams((prev) => {
    prev.set("page", String(p));
    return prev;
  });
};
```

---

## Derived State

ALWAYS compute during render. NEVER store and sync.

```tsx
// CORRECT: derive from source
const filteredItems = items.filter((i) => i.active);
const itemCount = items.length;

// WRONG: storing derived values
const [filteredItems, setFilteredItems] = useState([]);
useEffect(() => {
  setFilteredItems(items.filter((i) => i.active));
}, [items]);
```

---

## Edge Cases

- **useReducer over useState:** When you have 3+ related state values that change together (e.g., status/data/error triple), useReducer prevents impossible states.
- **Context + Zustand together:** Use Context for dependency-injected services (auth provider), Zustand for app state (cart, UI preferences). They solve different problems.
- **Stale closure in callbacks:** If a callback needs the latest state but is memoized with useCallback, use a ref to hold the current value instead of adding it to the dependency array.

---

## Rules Summary

Server data goes in React Query with key factories and proper invalidation. Global client state lives in Zustand with selectors for targeted re-renders. Context is for dependency injection with typed null defaults and throwing hooks. URL state uses useSearchParams for anything shareable. Derived values are computed during render, never stored. State mutates immutably. Frequently-changing values never go in Context. The useState+useEffect fetch pattern is banned — React Query handles caching, deduplication, refetching, and race conditions.
