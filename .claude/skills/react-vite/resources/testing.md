# Testing Patterns

Vitest, React Testing Library, and testing best practices.

---

## Test Structure

### DO ✅

```tsx
// Arrange-Act-Assert pattern
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('Counter', () => {
  it('increments count when button is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<Counter initialCount={0} />);

    // Act
    await user.click(screen.getByRole('button', { name: /increment/i }));

    // Assert
    expect(screen.getByText('Count: 1')).toBeInTheDocument();
  });

  it('calls onChange when count changes', async () => {
    // Arrange
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Counter onChange={handleChange} />);

    // Act
    await user.click(screen.getByRole('button', { name: /increment/i }));

    // Assert
    expect(handleChange).toHaveBeenCalledWith(1);
  });
});
```

### DON'T ❌

```tsx
// No structure, multiple concerns
test('counter works', async () => {
  render(<Counter />);
  fireEvent.click(screen.getByText('+')); // Use userEvent instead
  expect(screen.getByText('1')).toBeInTheDocument();
  fireEvent.click(screen.getByText('+'));
  fireEvent.click(screen.getByText('-'));
  expect(screen.getByText('1')).toBeInTheDocument();
  // Testing too many things!
});
```

---

## Query Priorities

### DO ✅

```tsx
// Priority order (most to least preferred)

// 1. Accessible queries (best)
screen.getByRole('button', { name: /submit/i });
screen.getByLabelText(/email/i);
screen.getByPlaceholderText(/search/i);
screen.getByText(/welcome/i);

// 2. Semantic queries
screen.getByAltText(/profile/i);
screen.getByTitle(/close/i);

// 3. Test IDs (last resort)
screen.getByTestId('custom-element');
```

### DON'T ❌

```tsx
// Implementation details
screen.getByClassName('btn-primary');
container.querySelector('.submit-button');
```

---

## User Interactions

### DO ✅

```tsx
import userEvent from '@testing-library/user-event';

it('submits form with user data', async () => {
  const user = userEvent.setup();
  const handleSubmit = vi.fn();
  
  render(<LoginForm onSubmit={handleSubmit} />);

  // Type in fields
  await user.type(screen.getByLabelText(/email/i), 'test@example.com');
  await user.type(screen.getByLabelText(/password/i), 'password123');

  // Submit form
  await user.click(screen.getByRole('button', { name: /sign in/i }));

  expect(handleSubmit).toHaveBeenCalledWith({
    email: 'test@example.com',
    password: 'password123',
  });
});

// Other interactions
await user.hover(element);
await user.unhover(element);
await user.selectOptions(select, 'option-value');
await user.clear(input);
await user.tab();
```

### DON'T ❌

```tsx
// fireEvent doesn't simulate real user behavior
fireEvent.change(input, { target: { value: 'text' } });
fireEvent.click(button);
```

---

## Async Testing

### DO ✅

```tsx
import { render, screen, waitFor } from '@testing-library/react';

it('loads and displays user data', async () => {
  render(<UserProfile userId="123" />);

  // Wait for loading to finish
  expect(screen.getByText(/loading/i)).toBeInTheDocument();

  // Wait for data to appear
  await waitFor(() => {
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  // Or use findBy (combines getBy + waitFor)
  const userName = await screen.findByText('John Doe');
  expect(userName).toBeInTheDocument();
});

it('handles error state', async () => {
  server.use(
    http.get('/api/user/:id', () => {
      return HttpResponse.error();
    })
  );

  render(<UserProfile userId="123" />);

  await screen.findByText(/error loading user/i);
});
```

---

## Mocking

### DO ✅

```tsx
// Mock modules
vi.mock('./api/users', () => ({
  getUser: vi.fn(),
}));

// Mock in test
import { getUser } from './api/users';

beforeEach(() => {
  vi.mocked(getUser).mockResolvedValue({ id: '1', name: 'John' });
});

// Mock fetch with MSW (recommended)
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

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

### DO ✅

```tsx
import { renderHook, act } from '@testing-library/react';

describe('useCounter', () => {
  it('increments counter', () => {
    const { result } = renderHook(() => useCounter(0));

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });

  it('accepts initial value', () => {
    const { result } = renderHook(() => useCounter(10));
    expect(result.current.count).toBe(10);
  });
});

// Hook with dependencies
describe('useUser', () => {
  it('fetches user data', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={new QueryClient()}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useUser('123'), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({ id: '123', name: 'John' });
  });
});
```

---

## Component Testing

### DO ✅

```tsx
// Test behavior, not implementation
describe('TodoList', () => {
  const mockTodos = [
    { id: '1', text: 'Learn React', completed: false },
    { id: '2', text: 'Write tests', completed: true },
  ];

  it('renders all todos', () => {
    render(<TodoList todos={mockTodos} />);

    expect(screen.getByText('Learn React')).toBeInTheDocument();
    expect(screen.getByText('Write tests')).toBeInTheDocument();
  });

  it('shows completed todos with strikethrough', () => {
    render(<TodoList todos={mockTodos} />);

    const completedTodo = screen.getByText('Write tests');
    expect(completedTodo).toHaveClass('line-through');
  });

  it('calls onToggle when checkbox clicked', async () => {
    const user = userEvent.setup();
    const handleToggle = vi.fn();

    render(<TodoList todos={mockTodos} onToggle={handleToggle} />);

    await user.click(screen.getAllByRole('checkbox')[0]);

    expect(handleToggle).toHaveBeenCalledWith('1');
  });

  it('shows empty state when no todos', () => {
    render(<TodoList todos={[]} />);

    expect(screen.getByText(/no todos yet/i)).toBeInTheDocument();
  });
});
```

---

## Test Utilities

### DO ✅

```tsx
// Custom render with providers
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function renderWithProviders(
  ui: React.ReactElement,
  options?: RenderOptions
) {
  const queryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {ui}
      </BrowserRouter>
    </QueryClientProvider>,
    options
  );
}

// Usage
it('renders with providers', () => {
  renderWithProviders(<MyComponent />);
});
```

---

## Snapshot Testing

### DO ✅

```tsx
// Use sparingly for stable UI
it('matches snapshot', () => {
  const { container } = render(<Button variant="primary">Click me</Button>);
  expect(container).toMatchSnapshot();
});

// Inline snapshots for small outputs
it('renders correct classes', () => {
  const { container } = render(<Button variant="primary" />);
  expect(container.firstChild).toMatchInlineSnapshot(`
    <button class="btn btn-primary">
      Click me
    </button>
  `);
});
```

### DON'T ❌

```tsx
// Snapshot entire pages
expect(container).toMatchSnapshot(); // Brittle, hard to review
```

---

## Quick Reference

| Query Type | When to Use |
|------------|-------------|
| getBy | Element exists, sync |
| queryBy | Element may not exist |
| findBy | Element appears async |
| getAllBy | Multiple elements |

| Testing Type | Focus |
|--------------|-------|
| Unit | Individual functions, hooks |
| Component | Single component behavior |
| Integration | Multiple components together |
| E2E | Full user flows (Playwright) |

| Best Practice | Why |
|---------------|-----|
| Query by role | Accessible, user-centric |
| Use userEvent | Realistic interactions |
| Test behavior | Refactor-proof |
| Mock at boundaries | Isolate from externals |
