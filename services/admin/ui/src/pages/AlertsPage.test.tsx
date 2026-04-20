import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../hooks/use-admin-api', () => ({
  useAlertsRecent: vi.fn(),
  useAlertConfig: vi.fn(),
}));

import { useAlertsRecent, useAlertConfig } from '../hooks/use-admin-api';
import { AlertsPage } from './AlertsPage';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('AlertsPage', () => {
  it('should export AlertsPage component', () => {
    expect(typeof AlertsPage).toBe('function');
  });

  it('should render timestamps via timeAgo instead of raw ISO string', () => {
    const isoTime = new Date(Date.now() - 5 * 60_000).toISOString();
    vi.mocked(useAlertsRecent).mockReturnValue({
      data: [
        { _id: 'a1', type: 'cost_spike', model: 'gpt-4', feature: 'triage', cost_usd: 0.05, timestamp: isoTime },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useAlertsRecent>);
    vi.mocked(useAlertConfig).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof useAlertConfig>);

    render(<AlertsPage />, { wrapper });
    expect(screen.getByText(/m ago/i)).toBeTruthy();
    // Should NOT render the raw ISO
    expect(screen.queryByText(isoTime)).toBeNull();
  });

  it('should filter alerts by severity when a pill is clicked', () => {
    vi.mocked(useAlertsRecent).mockReturnValue({
      data: [
        { _id: 'a1', type: 'critical_error', severity: 'critical', model: 'gpt-4', cost_usd: 1, timestamp: new Date().toISOString() },
        { _id: 'a2', type: 'warn_spike', severity: 'warning', model: 'gpt-4', cost_usd: 0.5, timestamp: new Date().toISOString() },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useAlertsRecent>);
    vi.mocked(useAlertConfig).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof useAlertConfig>);

    render(<AlertsPage />, { wrapper });
    expect(screen.getByText('critical_error')).toBeTruthy();
    expect(screen.getByText('warn_spike')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Critical' }));
    expect(screen.getByText('critical_error')).toBeTruthy();
    expect(screen.queryByText('warn_spike')).toBeNull();
  });

  it('should show error state when alerts query fails', () => {
    vi.mocked(useAlertsRecent).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('nope'),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useAlertsRecent>);
    vi.mocked(useAlertConfig).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof useAlertConfig>);

    render(<AlertsPage />, { wrapper });
    expect(screen.getByTestId('error-state')).toBeTruthy();
  });
});
