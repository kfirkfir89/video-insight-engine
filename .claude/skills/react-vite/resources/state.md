# State Management

Local state, context, server state, and global state patterns.

---

## useState Patterns

### DO ✅

```tsx
// Simple state
const [count, setCount] = useState(0);

// Functional updates for derived state
setCount((prev) => prev + 1);

// Lazy initial state (expensive computation)
const [data, setData] = useState(() => computeExpensiveValue());

// Object state - spread to update
const [user, setUser] = useState({ name: '', email: '' });
setUser((prev) => ({ ...prev, name: 'John' }));
```

### DON'T ❌

```tsx
// Mutating state directly
user.name = 'John';  // Won't re-render!
setUser(user);

// Storing derived state
const [items, setItems] = useState(data);
const [filteredItems, setFilteredItems] = useState([]); // ❌ Derive instead!
```

---

## useReducer

### DO ✅

```tsx
// Complex state with multiple related values
type State = {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: User | null;
  error: string | null;
};

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: User }
  | { type: 'FETCH_ERROR'; payload: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, status: 'loading', error: null };
    case 'FETCH_SUCCESS':
      return { status: 'success', data: action.payload, error: null };
    case 'FETCH_ERROR':
      return { status: 'error', data: null, error: action.payload };
    default:
      return state;
  }
}

// Usage
const [state, dispatch] = useReducer(reducer, {
  status: 'idle',
  data: null,
  error: null,
});

dispatch({ type: 'FETCH_START' });
```

---

## Context

### DO ✅

```tsx
// Create typed context
interface AuthContextType {
  user: User | null;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Custom hook with error if used outside provider
function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// Provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = async (credentials: Credentials) => {
    const user = await authApi.login(credentials);
    setUser(user);
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### DON'T ❌

```tsx
// Default value that hides errors
const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// Using context for frequently changing values
const MouseContext = createContext({ x: 0, y: 0 }); // Re-renders everything!
```

---

## React Query (Server State)

### DO ✅

```tsx
// Fetch data with caching
function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => api.getUsers(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Usage in component
function UserList() {
  const { data: users, isLoading, error } = useUsers();

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}

// Mutations
function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserData) => api.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
```

### DON'T ❌

```tsx
// Manual server state management
const [users, setUsers] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

useEffect(() => {
  setLoading(true);
  fetch('/api/users')
    .then((res) => res.json())
    .then(setUsers)
    .catch(setError)
    .finally(() => setLoading(false));
}, []);
// Missing: caching, refetching, race conditions, deduplication...
```

---

## Zustand (Global State)

### DO ✅

```tsx
import { create } from 'zustand';

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  total: () => number;
}

const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  
  addItem: (item) =>
    set((state) => ({
      items: [...state.items, item],
    })),
    
  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),
    
  clearCart: () => set({ items: [] }),
  
  total: () => get().items.reduce((sum, item) => sum + item.price, 0),
}));

// Usage - only re-renders when selected state changes
function CartCount() {
  const count = useCartStore((state) => state.items.length);
  return <span>{count}</span>;
}
```

---

## URL State

### DO ✅

```tsx
import { useSearchParams } from 'react-router-dom';

function ProductList() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const category = searchParams.get('category') ?? 'all';
  const sort = searchParams.get('sort') ?? 'newest';
  const page = Number(searchParams.get('page')) || 1;

  // Update URL state
  const setCategory = (newCategory: string) => {
    setSearchParams((prev) => {
      prev.set('category', newCategory);
      prev.set('page', '1'); // Reset page
      return prev;
    });
  };

  // React Query with URL state
  const { data } = useQuery({
    queryKey: ['products', { category, sort, page }],
    queryFn: () => api.getProducts({ category, sort, page }),
  });

  return (/* ... */);
}
```

---

## Derived State

### DO ✅

```tsx
// Compute, don't store
function TodoList({ todos }: { todos: Todo[] }) {
  // ✅ Derived from props
  const completedCount = todos.filter((t) => t.completed).length;
  const pendingCount = todos.length - completedCount;

  return (
    <div>
      <p>Completed: {completedCount}</p>
      <p>Pending: {pendingCount}</p>
    </div>
  );
}
```

### DON'T ❌

```tsx
// Storing derived values
function TodoList({ todos }: { todos: Todo[] }) {
  const [completedCount, setCompletedCount] = useState(0);

  // ❌ Syncing state
  useEffect(() => {
    setCompletedCount(todos.filter((t) => t.completed).length);
  }, [todos]);

  return <p>Completed: {completedCount}</p>;
}
```

---

## Quick Reference

| State Type | Solution |
|------------|----------|
| Component UI state | useState |
| Complex local state | useReducer |
| Server data | React Query / SWR |
| Global UI state | Context or Zustand |
| Shareable state | URL params |
| Form state | React Hook Form |

| Pattern | When to Use |
|---------|-------------|
| Lift state up | Multiple components need same state |
| Context | Avoid prop drilling (> 2 levels) |
| React Query | Server state with caching |
| Zustand | Simple global state |
| URL state | Filters, pagination, shareable state |
