# Routing Patterns

React Router 7.x — navigation, layouts, guards, and route organization.

<rules>
- ALWAYS use `Link`/`NavLink` for internal navigation — never `<a href>` (causes full page reload, loses React state)
- ALWAYS use layout routes with `<Outlet>` for shared UI — never duplicate headers/footers across routes (causes inconsistency and maintenance burden)
- ALWAYS lazy-load non-critical route components with `lazy()` + `<Suspense>` (causes bloated initial bundle if eager-loaded)
- ALWAYS use `useSearchParams` for filters/pagination — never local state for URL-shareable data (causes non-shareable, non-bookmarkable state)
- ALWAYS add `errorElement` to routes for error handling (causes blank screens on route errors)
- NEVER use `window.location` for navigation — use `useNavigate` (causes full page reload, loses app state)
- NEVER use programmatic navigation without the `replace` option for post-login redirects (causes broken back button)
</rules>

---

## Layout Routes

ALWAYS nest routes under layout routes with `<Outlet>` for shared chrome.

```tsx
<Routes>
  <Route path="/" element={<PublicLayout />}>
    <Route index element={<Home />} />
    <Route path="about" element={<About />} />
  </Route>
  <Route path="/dashboard" element={<DashboardLayout />}>
    <Route index element={<Dashboard />} />
    <Route path="settings" element={<Settings />} />
  </Route>
  <Route path="*" element={<NotFound />} />
</Routes>
```

---

## Protected Routes

ALWAYS save attempted location for redirect after login. ALWAYS show skeleton during auth check.

```tsx
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <PageSkeleton />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}
```

For role-based access, check `user.roles` and redirect to `/unauthorized`.

---

## Lazy Loading Routes

ALWAYS lazy-load route components. Keep home/landing eager for fast initial load.

```tsx
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Settings = lazy(() => import("./pages/Settings"));

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

---

## Navigation

Use `Link` for declarative links, `NavLink` for active-state styling, `useNavigate` for programmatic navigation.

```tsx
<NavLink
  to="/dashboard"
  className={({ isActive }) => (isActive ? "font-bold" : "")}
>
  Dashboard
</NavLink>;

// Post-login redirect
const from = location.state?.from?.pathname || "/dashboard";
navigate(from, { replace: true });
```

---

## Route Error Handling

ALWAYS add `errorElement` to catch route-level errors.

```tsx
<Route
  path="users/:id"
  element={<UserProfile />}
  errorElement={<RouteErrorBoundary />}
/>
```

---

## Edge Cases

- **Search params vs path params:** Use path params (`:id`) for resource identity. Use search params (`?filter=x`) for optional state that changes frequently.
- **Nested protected routes:** Wrap the layout route, not individual child routes. Children inherit protection from the parent.
- **Route config objects:** For complex apps, prefer `useRoutes(routeConfig)` over JSX `<Routes>` — easier to test and generate programmatically.

---

## Rules Summary

All internal navigation uses React Router Link/NavLink/useNavigate — never anchor tags or window.location. Routes are organized with layout nesting and Outlet, lazy-loaded with Suspense, and protected with guard components that save the attempted location. Search params hold shareable state, path params hold resource identity, and every route has an errorElement fallback. Post-login redirects always use `replace: true`.
