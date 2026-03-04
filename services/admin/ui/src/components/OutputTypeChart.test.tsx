import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OutputTypeChart } from './OutputTypeChart';

vi.mock('../hooks/use-admin-api', () => ({
  useUsageByOutputType: vi.fn(),
}));

import { useUsageByOutputType } from '../hooks/use-admin-api';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('OutputTypeChart', () => {
  it('should render loading skeleton when loading', () => {
    vi.mocked(useUsageByOutputType).mockReturnValue({ data: undefined, isLoading: true } as unknown as ReturnType<typeof useUsageByOutputType>);
    const { container } = render(<OutputTypeChart />, { wrapper });
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('should render empty state when data is empty', () => {
    vi.mocked(useUsageByOutputType).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useUsageByOutputType>);
    render(<OutputTypeChart />, { wrapper });
    expect(screen.getByText('No output type data available')).toBeTruthy();
  });

  it('should render chart heading when data is present', () => {
    vi.mocked(useUsageByOutputType).mockReturnValue({
      data: [{ output_type: 'summary', cost_usd: 5.23, calls: 450, tokens: 125000 }],
      isLoading: false,
    } as unknown as ReturnType<typeof useUsageByOutputType>);
    render(<OutputTypeChart />, { wrapper });
    expect(screen.getByText('Cost by Output Type')).toBeTruthy();
  });
});
