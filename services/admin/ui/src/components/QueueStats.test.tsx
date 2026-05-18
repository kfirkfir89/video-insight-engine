import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../hooks/use-admin-api', () => ({
  useQueueStats: vi.fn(),
}));

import { useQueueStats } from '../hooks/use-admin-api';
import { QueueStats } from './QueueStats';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

function mockQuery(value: Partial<ReturnType<typeof useQueueStats>>) {
  vi.mocked(useQueueStats).mockReturnValue(value as ReturnType<typeof useQueueStats>);
}

describe('QueueStats', () => {
  it('should export QueueStats component', () => {
    expect(typeof QueueStats).toBe('function');
  });

  it('should render skeleton while loading', () => {
    mockQuery({ data: undefined, isLoading: true, isError: false });
    const { container } = render(<QueueStats />, { wrapper });
    expect(container.querySelector('[data-slot="skeleton-panel"]')).not.toBeNull();
  });

  it('should render ErrorState when stats query fails', () => {
    mockQuery({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('boom'),
      refetch: vi.fn(),
    });
    render(<QueueStats />, { wrapper });
    expect(screen.getByTestId('error-state')).toBeTruthy();
  });

  it('should render four metric tiles with the expected numbers', () => {
    mockQuery({
      data: {
        main: { messages: 5, ready: 3, inFlight: 2, consumers: 2 },
        dlq: { messages: 0 },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<QueueStats />, { wrapper });
    expect(screen.getByTestId('queue-metric-ready').textContent).toContain('3');
    expect(screen.getByTestId('queue-metric-in-flight').textContent).toContain('2');
    expect(screen.getByTestId('queue-metric-consumers').textContent).toContain('2');
    expect(screen.getByTestId('queue-metric-dlq').textContent).toContain('0');
  });

  it('should colour the DLQ tile as warning when it has messages', () => {
    mockQuery({
      data: {
        main: { messages: 0, ready: 0, inFlight: 0, consumers: 2 },
        dlq: { messages: 4 },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<QueueStats />, { wrapper });
    const dlqTile = screen.getByTestId('queue-metric-dlq');
    const valueNode = dlqTile.querySelector('p') as HTMLElement;
    expect(valueNode.style.color).toContain('warning');
  });

  it('should colour the Consumers tile as danger when zero workers are connected', () => {
    mockQuery({
      data: {
        main: { messages: 0, ready: 0, inFlight: 0, consumers: 0 },
        dlq: { messages: 0 },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<QueueStats />, { wrapper });
    const consumersTile = screen.getByTestId('queue-metric-consumers');
    const valueNode = consumersTile.querySelector('p') as HTMLElement;
    expect(valueNode.style.color).toContain('danger');
  });
});
