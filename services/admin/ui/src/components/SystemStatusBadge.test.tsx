import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../hooks/use-admin-api', () => ({
  useHealthOverview: vi.fn(),
}));

import { useHealthOverview } from '../hooks/use-admin-api';
import { SystemStatusBadge } from './SystemStatusBadge';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

function mockOverview(value: Partial<ReturnType<typeof useHealthOverview>>) {
  vi.mocked(useHealthOverview).mockReturnValue(value as ReturnType<typeof useHealthOverview>);
}

describe('SystemStatusBadge', () => {
  it('should show unknown until the first poll completes', () => {
    mockOverview({ data: undefined, isError: false });
    render(<SystemStatusBadge />, { wrapper });
    expect(screen.getByTestId('system-status').getAttribute('data-status')).toBe('unknown');
  });

  it('should list the unhealthy services when degraded', () => {
    mockOverview({
      data: {
        status: 'degraded',
        services: { 'vie-api': { status: 'healthy' }, 'vie-assistant': { status: 'timeout' } },
        checked_at: new Date().toISOString(),
      },
      isError: false,
    });
    render(<SystemStatusBadge />, { wrapper });
    expect(screen.getByText('Degraded')).toBeTruthy();
    expect(screen.getByText('vie-assistant: timeout')).toBeTruthy();
  });

  it('should treat a failed overview query as unknown', () => {
    mockOverview({ data: undefined, isError: true });
    render(<SystemStatusBadge />, { wrapper });
    expect(screen.getByText('Status unknown')).toBeTruthy();
  });

  it('should not present a stale payload as current once the query errors', () => {
    mockOverview({
      data: {
        status: 'degraded',
        services: { 'vie-assistant': { status: 'timeout' } },
        checked_at: new Date().toISOString(),
      },
      isError: true,
    });
    render(<SystemStatusBadge />, { wrapper });
    expect(screen.getByText('Status unknown')).toBeTruthy();
    expect(screen.queryByText('vie-assistant: timeout')).toBeNull();
    expect(screen.queryByText(/checked/)).toBeNull();
  });

  it('should render an unrecognised rollup value as unknown instead of blank', () => {
    mockOverview({
      data: { status: 'weird' as unknown as 'healthy', services: {}, checked_at: new Date().toISOString() },
      isError: false,
    });
    render(<SystemStatusBadge />, { wrapper });
    expect(screen.getByTestId('system-status').getAttribute('data-status')).toBe('unknown');
    expect(screen.getByText('Status unknown')).toBeTruthy();
  });
});
