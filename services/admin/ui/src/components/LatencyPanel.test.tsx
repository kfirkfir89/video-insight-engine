import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../hooks/use-admin-api', () => ({
  useUsageByFeature: vi.fn(),
}));

import { useUsageByFeature } from '../hooks/use-admin-api';
import { LatencyPanel } from './LatencyPanel';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('LatencyPanel', () => {
  it('should render p50/p95 per feature sorted by p95 descending', () => {
    vi.mocked(useUsageByFeature).mockReturnValue({
      data: [
        { feature: 'summarize:classify', calls: 10, cost_usd: 0.1, avg_duration_ms: 800, p50_duration_ms: 700, p95_duration_ms: 1500 },
        { feature: 'summarize:extraction', calls: 10, cost_usd: 1, avg_duration_ms: 9000, p50_duration_ms: 8000, p95_duration_ms: 21000 },
      ],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useUsageByFeature>);
    render(<LatencyPanel />, { wrapper });
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('summarize:extraction');
    expect(rows[0].textContent).toContain('21,000ms');
    expect(rows[1].textContent).toContain('1,500ms');
  });

  it('should show a dash when percentiles are missing (pre-upgrade rows)', () => {
    vi.mocked(useUsageByFeature).mockReturnValue({
      data: [{ feature: 'x', calls: 1, cost_usd: 0, avg_duration_ms: 5 }],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useUsageByFeature>);
    render(<LatencyPanel />, { wrapper });
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
