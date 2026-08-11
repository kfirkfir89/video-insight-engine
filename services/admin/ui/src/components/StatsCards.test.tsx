import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../hooks/use-admin-api', () => ({
  useUsageStats: vi.fn(),
}));

import { useUsageStats } from '../hooks/use-admin-api';
import { StatsCards } from './StatsCards';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('StatsCards', () => {
  it('should export StatsCards component', () => {
    expect(typeof StatsCards).toBe('function');
  });

  it('should render ErrorState when stats query fails', () => {
    vi.mocked(useUsageStats).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('boom'),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useUsageStats>);

    render(<StatsCards />, { wrapper });
    expect(screen.getByTestId('error-state')).toBeTruthy();
  });

  it('should render InfoTip next to ambiguous labels', () => {
    vi.mocked(useUsageStats).mockReturnValue({
      data: {
        total_cost_usd: 10,
        total_calls: 100,
        success_count: 90,
        avg_duration_ms: 500,
        total_tokens: 50_000,
      } as unknown as Record<string, number>,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useUsageStats>);

    render(<StatsCards />, { wrapper });
    // Success Rate + Avg Duration + Total Tokens have tooltips
    expect(screen.getByLabelText('Success Rate explanation')).toBeTruthy();
    expect(screen.getByLabelText('Avg Duration explanation')).toBeTruthy();
    expect(screen.getByLabelText('Total Tokens explanation')).toBeTruthy();
  });

  it('should render skeletons while loading', () => {
    vi.mocked(useUsageStats).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useUsageStats>);

    const { container } = render(<StatsCards />, { wrapper });
    expect(container.querySelectorAll('[data-slot="skeleton-panel"]').length).toBe(5);
  });
});
