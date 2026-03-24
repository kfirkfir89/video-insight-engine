# Testing Patterns

Vitest, React Testing Library, and testing best practices.

<rules>
- ALWAYS use `userEvent` over `fireEvent` — userEvent simulates real browser behavior (causes missed bugs with synthetic events)
- ALWAYS query by accessible role first (`getByRole`), then label, then text — never by class name or CSS selector (causes brittle tests coupled to implementation)
- ALWAYS use the Arrange-Act-Assert pattern with one primary assertion per test (causes debugging difficulty with multi-concern tests)
- ALWAYS use MSW for API mocking in integration tests — never mock fetch directly (causes unrealistic test behavior)
- ALWAYS create a `renderWithProviders` helper wrapping QueryClient + Router for component tests (causes boilerplate and missing context errors)
- NEVER test implementation details (internal state, class names, component structure) — test behavior (causes tests that break on refactoring)
- NEVER snapshot entire pages — only stable small components (causes meaningless diff noise)
</rules>

---

## Test Structure

ALWAYS follow Arrange-Act-Assert. One logical assertion per test.

```tsx
describe('Counter', () => {
  it('increments count when button is clicked', async () => {
    const user = userEvent.setup();
    render(<Counter initialCount={0} />);
    await user.click(screen.getByRole('button', { name: /increment/i }));
    expect(screen.getByText('Count: 1')).toBeInTheDocument();
  });
});
```

---

## Query Priority

1. `getByRole` — accessible queries (best)
2. `getByLabelText`, `getByPlaceholderText`, `getByText`
3. `getByAltText`, `getByTitle`
4. `getByTestId` — last resort only

NEVER use `getByClassName`, `querySelector`, or any selector tied to styling.

---

## Async Testing

Use `findBy` (combines getBy + waitFor) for elements that appear asynchronously. Use `waitFor` for assertions on async state changes.

```tsx
it('loads user data', async () => {
  render(<UserProfile userId="123" />);
  expect(screen.getByText(/loading/i)).toBeInTheDocument();
  const userName = await screen.findByText('John Doe');
  expect(userName).toBeInTheDocument();
});
```

---

## Mocking with MSW

ALWAYS prefer MSW over manual fetch mocking for realistic network behavior.

```tsx
const server = setupServer(
  http.get('/api/users/:id', ({ params }) => {
    return HttpResponse.json({ id: params.id, name: 'John Doe' });
  })
);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

---

## Testing Hooks

Use `renderHook` with a wrapper providing required context (QueryClient, Router).

```tsx
const { result } = renderHook(() => useCounter(0));
act(() => { result.current.increment(); });
expect(result.current.count).toBe(1);
```

---

## Test Utilities

ALWAYS create a custom render that wraps providers.

```tsx
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}
```

---

## Edge Cases

- **Testing loading states:** Assert the loading indicator FIRST, then `await findBy` for the loaded content. This catches regressions where loading is skipped.
- **Testing error states:** Use `server.use()` to override a handler for a single test. This isolates error path testing.
- **Snapshot testing:** Use inline snapshots for small stable outputs only. Never snapshot dynamic content or whole pages.

---

## Rules Summary

Test behavior, not implementation. Query by accessible role, interact with userEvent, assert one thing per test. Mock APIs at the network level with MSW, wrap components in a renderWithProviders helper, and use renderHook for hook testing. Async elements use findBy, error paths use per-test server overrides, and snapshots are reserved for small stable components only.
