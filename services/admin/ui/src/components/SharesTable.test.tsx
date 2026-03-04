import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SharesTable } from './SharesTable';

vi.mock('../hooks/use-admin-api', () => ({
  useSharesTop: vi.fn(),
}));

import { useSharesTop } from '../hooks/use-admin-api';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('SharesTable', () => {
  it('should render loading skeleton when loading', () => {
    vi.mocked(useSharesTop).mockReturnValue({ data: undefined, isLoading: true } as unknown as ReturnType<typeof useSharesTop>);
    const { container } = render(<SharesTable />, { wrapper });
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('should render empty state when data is empty', () => {
    vi.mocked(useSharesTop).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useSharesTop>);
    render(<SharesTable />, { wrapper });
    expect(screen.getByText('No shared outputs yet')).toBeTruthy();
  });

  it('should render table with data', () => {
    vi.mocked(useSharesTop).mockReturnValue({
      data: [
        { title: 'Test Video', youtubeId: 'abc', shareSlug: 'test', viewsCount: 100, likesCount: 10, sharedAt: '2026-01-01T00:00:00Z', outputType: 'recipe' },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useSharesTop>);
    render(<SharesTable />, { wrapper });
    expect(screen.getByText('Top Shared Outputs')).toBeTruthy();
    expect(screen.getByText('Test Video')).toBeTruthy();
    expect(screen.getByText('Recipe')).toBeTruthy();
  });
});
