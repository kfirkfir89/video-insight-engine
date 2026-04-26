import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const modelMock = vi.fn();
const featureMock = vi.fn();
const outputMock = vi.fn();

vi.mock('../hooks/use-admin-api', () => ({
  useUsageByModel: (...args: unknown[]) => modelMock(...args),
  useUsageByFeature: (...args: unknown[]) => featureMock(...args),
  useUsageByOutputType: (...args: unknown[]) => outputMock(...args),
}));

// Recharts ResponsiveContainer needs width; stub it to render children directly
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container" style={{ width: 600, height: 320 }}>
        {children}
      </div>
    ),
  };
});

import { CostBreakdownSwitcher } from './CostBreakdownSwitcher';

const loading = { data: undefined, isLoading: true, isError: false, error: null };
const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
const fail = (error: unknown) => ({
  data: undefined,
  isLoading: false,
  isError: true,
  error,
});

describe('CostBreakdownSwitcher', () => {
  beforeEach(() => {
    modelMock.mockReset();
    featureMock.mockReset();
    outputMock.mockReset();
  });

  it('should show skeleton while active query is loading', () => {
    modelMock.mockReturnValue(loading);
    featureMock.mockReturnValue(loading);
    outputMock.mockReturnValue(loading);

    const { container } = render(<CostBreakdownSwitcher />);
    expect(container.querySelector('[data-slot="skeleton-panel"]')).not.toBeNull();
  });

  it('should render bar chart when data loads', () => {
    modelMock.mockReturnValue(
      ok([
        { model: 'anthropic/claude-sonnet-4-6', cost_usd: 2.5, calls: 10 },
        { model: 'openai/gpt-4o-mini', cost_usd: 0.5, calls: 100 },
      ]),
    );
    featureMock.mockReturnValue(loading);
    outputMock.mockReturnValue(loading);

    render(<CostBreakdownSwitcher />);
    expect(screen.getByTestId('responsive-container')).toBeTruthy();
  });

  it('should switch data source when toggle is clicked', () => {
    modelMock.mockReturnValue(ok([{ model: 'x/y-z', cost_usd: 1, calls: 1 }]));
    featureMock.mockReturnValue(ok([{ feature: 'triage', cost_usd: 3, calls: 5 }]));
    outputMock.mockReturnValue(ok([]));

    render(<CostBreakdownSwitcher />);

    // starts in model view
    const body = screen.getByTestId('cost-breakdown-body');
    expect(body.getAttribute('data-view')).toBe('model');

    fireEvent.click(screen.getByRole('tab', { name: 'By feature' }));
    expect(body.getAttribute('data-view')).toBe('feature');

    fireEvent.click(screen.getByRole('tab', { name: 'By output' }));
    expect(body.getAttribute('data-view')).toBe('output');
  });

  it('should render segmented control with three views', () => {
    modelMock.mockReturnValue(ok([]));
    featureMock.mockReturnValue(ok([]));
    outputMock.mockReturnValue(ok([]));

    render(<CostBreakdownSwitcher />);
    expect(screen.getByRole('tab', { name: 'By model' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'By feature' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'By output' })).toBeTruthy();
  });

  it('should show empty state when active view has no data', () => {
    modelMock.mockReturnValue(ok([]));
    featureMock.mockReturnValue(ok([]));
    outputMock.mockReturnValue(ok([]));

    render(<CostBreakdownSwitcher />);
    expect(screen.getByTestId('cost-breakdown-empty')).toBeTruthy();
  });

  it('should show ErrorState when active query fails', () => {
    modelMock.mockReturnValue(fail(new Error('network')));
    featureMock.mockReturnValue(ok([]));
    outputMock.mockReturnValue(ok([]));

    render(<CostBreakdownSwitcher />);
    expect(screen.getByTestId('error-state')).toBeTruthy();
  });

  it('should pass days param to all three hooks', () => {
    modelMock.mockReturnValue(ok([]));
    featureMock.mockReturnValue(ok([]));
    outputMock.mockReturnValue(ok([]));

    render(<CostBreakdownSwitcher days={7} />);
    expect(modelMock).toHaveBeenCalledWith(7, expect.anything());
    expect(featureMock).toHaveBeenCalledWith(7, expect.anything());
    expect(outputMock).toHaveBeenCalledWith(7, expect.anything());
  });

  it('should gate fetches so only the active view is enabled on initial render', () => {
    modelMock.mockReturnValue(ok([]));
    featureMock.mockReturnValue(ok([]));
    outputMock.mockReturnValue(ok([]));

    render(<CostBreakdownSwitcher days={7} />);
    // Initial view is 'model' → model enabled, others disabled
    expect(modelMock).toHaveBeenCalledWith(7, { enabled: true });
    expect(featureMock).toHaveBeenCalledWith(7, { enabled: false });
    expect(outputMock).toHaveBeenCalledWith(7, { enabled: false });
  });

  it('should enable only the feature hook after switching to feature view', () => {
    modelMock.mockReturnValue(ok([]));
    featureMock.mockReturnValue(ok([]));
    outputMock.mockReturnValue(ok([]));

    render(<CostBreakdownSwitcher days={7} />);
    modelMock.mockClear();
    featureMock.mockClear();
    outputMock.mockClear();

    fireEvent.click(screen.getByRole('tab', { name: 'By feature' }));

    expect(featureMock).toHaveBeenCalledWith(7, { enabled: true });
    // Other hooks called only with enabled:false
    for (const call of modelMock.mock.calls) {
      expect(call[1]).toEqual({ enabled: false });
    }
    for (const call of outputMock.mock.calls) {
      expect(call[1]).toEqual({ enabled: false });
    }
  });

  it('should show retry button on error and call refetch when clicked', () => {
    const refetchMock = vi.fn();
    modelMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('boom'),
      refetch: refetchMock,
    });
    featureMock.mockReturnValue(ok([]));
    outputMock.mockReturnValue(ok([]));

    render(<CostBreakdownSwitcher />);
    const retry = screen.getByRole('button', { name: /retry/i });
    expect(retry).toBeTruthy();
    fireEvent.click(retry);
    expect(refetchMock).toHaveBeenCalled();
  });

  it('should mark active tab with aria-selected=true', () => {
    modelMock.mockReturnValue(ok([]));
    featureMock.mockReturnValue(ok([]));
    outputMock.mockReturnValue(ok([]));

    render(<CostBreakdownSwitcher />);
    const modelTab = screen.getByRole('tab', { name: 'By model' });
    expect(modelTab.getAttribute('aria-selected')).toBe('true');

    fireEvent.click(screen.getByRole('tab', { name: 'By feature' }));
    expect(modelTab.getAttribute('aria-selected')).toBe('false');
    expect(screen.getByRole('tab', { name: 'By feature' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });
});
