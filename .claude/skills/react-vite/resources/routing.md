# Routing Patterns

React Router, navigation, and route organization.

---

## Basic Setup

### DO ✅

```tsx
// main.tsx
import { BrowserRouter } from 'react-router-dom';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

// App.tsx
import { Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="users" element={<Users />} />
        <Route path="users/:id" element={<UserDetail />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
```

---

## Layout Routes

### DO ✅

```tsx
// Shared layout with Outlet
function Layout() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto py-8">
        <Outlet /> {/* Child routes render here */}
      </main>
      <Footer />
    </div>
  );
}

// Nested layouts
<Routes>
  <Route path="/" element={<PublicLayout />}>
    <Route index element={<Home />} />
    <Route path="about" element={<About />} />
  </Route>
  
  <Route path="/dashboard" element={<DashboardLayout />}>
    <Route index element={<DashboardHome />} />
    <Route path="settings" element={<Settings />} />
    <Route path="analytics" element={<Analytics />} />
  </Route>
</Routes>
```

---

## Protected Routes

### DO ✅

```tsx
// Auth guard component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

// Usage
<Routes>
  <Route path="/login" element={<Login />} />
  
  <Route
    path="/dashboard"
    element={
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    }
  >
    <Route index element={<Dashboard />} />
    <Route path="settings" element={<Settings />} />
  </Route>
</Routes>

// Role-based protection
function RequireRole({ role, children }: { role: string; children: React.ReactNode }) {
  const { user } = useAuth();

  if (!user?.roles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
```

---

## Dynamic Routes

### DO ✅

```tsx
// Route with params
<Route path="users/:userId" element={<UserProfile />} />
<Route path="posts/:postId/comments/:commentId" element={<Comment />} />

// Access params in component
function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  
  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => api.getUser(userId!),
  });

  if (isLoading) return <Skeleton />;
  if (!user) return <NotFound />;

  return <UserCard user={user} />;
}
```

---

## Navigation

### DO ✅

```tsx
// Declarative navigation
import { Link, NavLink } from 'react-router-dom';

// Basic link
<Link to="/about">About</Link>

// NavLink with active state
<NavLink
  to="/dashboard"
  className={({ isActive }) =>
    isActive ? 'text-blue-600 font-bold' : 'text-gray-600'
  }
>
  Dashboard
</NavLink>

// Programmatic navigation
function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (data: LoginData) => {
    await login(data);
    
    // Redirect to previous page or default
    const from = location.state?.from?.pathname || '/dashboard';
    navigate(from, { replace: true });
  };

  return (/* form */);
}
```

### DON'T ❌

```tsx
// Using <a> tags for internal navigation
<a href="/about">About</a> // Full page reload!

// window.location for navigation
window.location.href = '/dashboard'; // Loses React state!
```

---

## Search Params

### DO ✅

```tsx
function ProductList() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read params
  const category = searchParams.get('category') ?? 'all';
  const sort = searchParams.get('sort') ?? 'newest';
  const page = Number(searchParams.get('page')) || 1;

  // Update single param
  const setCategory = (value: string) => {
    setSearchParams((prev) => {
      prev.set('category', value);
      prev.set('page', '1'); // Reset page on filter change
      return prev;
    });
  };

  // Update multiple params
  const setFilters = (filters: Record<string, string>) => {
    setSearchParams(filters);
  };

  return (
    <div>
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="all">All</option>
        <option value="electronics">Electronics</option>
      </select>
      
      <ProductGrid category={category} sort={sort} page={page} />
      
      <Pagination
        page={page}
        onPageChange={(p) => setSearchParams((prev) => {
          prev.set('page', String(p));
          return prev;
        })}
      />
    </div>
  );
}
```

---

## Lazy Loading Routes

### DO ✅

```tsx
import { lazy, Suspense } from 'react';

// Lazy load route components
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const Analytics = lazy(() => import('./pages/Analytics'));

function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} /> {/* Keep home eager */}
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="settings" element={<Settings />} />
          <Route path="analytics" element={<Analytics />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
```

---

## Route Configuration

### DO ✅

```tsx
// Centralized route config
const routes = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'about', element: <About /> },
      {
        path: 'dashboard',
        element: <ProtectedRoute><DashboardLayout /></ProtectedRoute>,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'settings', element: <Settings /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
];

// Use with useRoutes
function App() {
  const element = useRoutes(routes);
  return element;
}
```

---

## Error Handling

### DO ✅

```tsx
// Route error boundary
import { useRouteError, isRouteErrorResponse } from 'react-router-dom';

function RouteErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return <NotFound />;
    }
    return <ErrorPage status={error.status} message={error.statusText} />;
  }

  return <ErrorPage message="Something went wrong" />;
}

// Usage
<Route
  path="users/:id"
  element={<UserProfile />}
  errorElement={<RouteErrorBoundary />}
/>
```

---

## Quick Reference

| Hook | Purpose |
|------|---------|
| useParams | Access route params |
| useSearchParams | Read/write URL query string |
| useNavigate | Programmatic navigation |
| useLocation | Current location object |
| useMatch | Check if route matches |

| Component | Purpose |
|-----------|---------|
| Link | Declarative navigation |
| NavLink | Link with active state |
| Navigate | Redirect component |
| Outlet | Render child routes |

| Pattern | When to Use |
|---------|-------------|
| Layout routes | Shared UI across routes |
| Protected routes | Auth-required pages |
| Lazy routes | Code splitting |
| Search params | Filters, pagination |
