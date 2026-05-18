import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { UsageTile } from '../UsageTile';
import * as usageHook from '@/hooks/use-usage';

function renderTile() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <UsageTile />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('UsageTile', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should render a loading state while the query is pending', () => {
    vi.spyOn(usageHook, 'useUserUsage').mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderTile();

    expect(screen.getByRole('status')).toHaveTextContent(/loading usage/i);
  });

  it('should display the effective spend and remaining budget for a free user', () => {
    vi.spyOn(usageHook, 'useUserUsage').mockReturnValue({
      data: {
        tier: 'free',
        today: { date: '2026-05-15', rawUsd: 1.25, creditAdjustmentUsd: 0, effectiveUsd: 1.25, videoCount: 2 },
        limitUsd: 2,
        remainingUsd: 0.75,
        resetAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      },
      isLoading: false,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderTile();

    expect(screen.getByText('$1.25')).toBeInTheDocument();
    expect(screen.getByText(/of \$2\.00/)).toBeInTheDocument();
    expect(screen.getByText(/2 videos processed/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '63');
    expect(screen.getByTestId('usage-tile-upgrade-cta')).toBeInTheDocument();
  });

  it('should show an unlimited label and hide the progress bar for paid tiers', () => {
    vi.spyOn(usageHook, 'useUserUsage').mockReturnValue({
      data: {
        tier: 'pro',
        today: { date: '2026-05-15', rawUsd: 4.2, creditAdjustmentUsd: 0, effectiveUsd: 4.2, videoCount: 5 },
        limitUsd: -1,
        remainingUsd: Number.POSITIVE_INFINITY,
        resetAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
      isLoading: false,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderTile();

    expect(screen.getByText('Unlimited')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByTestId('usage-tile-upgrade-cta')).toBeNull();
  });
});
