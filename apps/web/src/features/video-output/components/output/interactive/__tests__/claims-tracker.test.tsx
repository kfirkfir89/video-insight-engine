import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ClaimsTracker } from '../ClaimsTracker';
import type { ClaimItem } from '@vie/types';

const claims: ClaimItem[] = [
  {
    claim: 'The plan creates 1,200 jobs',
    source: 'Mayor Diaz',
    status: 'disputed',
    sourceCitation: 'Independent analysts put the figure near 700.',
    timestamp: 210,
  },
  {
    claim: 'Fares will rise 15% in 2026',
    source: 'Transit Authority',
    status: 'verified',
    timestamp: 540,
  },
  {
    claim: 'The city faces a structural deficit',
    source: 'Reporter',
    status: 'context',
  },
];

describe('ClaimsTracker', () => {
  it('renders every claim with its text and source', () => {
    render(<ClaimsTracker claims={claims} />);
    expect(screen.getByText('The plan creates 1,200 jobs')).toBeInTheDocument();
    expect(screen.getByText('Mayor Diaz')).toBeInTheDocument();
    expect(screen.getByText('Fares will rise 15% in 2026')).toBeInTheDocument();
    expect(screen.getByText('Transit Authority')).toBeInTheDocument();
  });

  it('renders a status badge per claim', () => {
    render(<ClaimsTracker claims={claims} />);
    const list = screen.getByRole('list', { name: /tracked claims/i });
    expect(within(list).getByText('Verified')).toBeInTheDocument();
    expect(within(list).getByText('Disputed')).toBeInTheDocument();
    expect(within(list).getByText('Context')).toBeInTheDocument();
  });

  it('shows the source citation when present', () => {
    render(<ClaimsTracker claims={claims} />);
    expect(
      screen.getByText('Independent analysts put the figure near 700.'),
    ).toBeInTheDocument();
  });

  it('filters claims to a single status when a filter tab is clicked', async () => {
    const user = userEvent.setup();
    render(<ClaimsTracker claims={claims} />);
    await user.click(screen.getByRole('tab', { name: /disputed/i }));
    const list = screen.getByRole('list', { name: /tracked claims/i });
    expect(within(list).getByText('The plan creates 1,200 jobs')).toBeInTheDocument();
    expect(within(list).queryByText('Fares will rise 15% in 2026')).not.toBeInTheDocument();
  });

  it('seeks to the claim timestamp when the timestamp button is clicked', async () => {
    const user = userEvent.setup();
    const onSeek = vi.fn();
    render(<ClaimsTracker claims={claims} onSeek={onSeek} />);
    await user.click(screen.getByRole('button', { name: /jump to 3:30/i }));
    expect(onSeek).toHaveBeenCalledWith(210);
  });

  it('renders an empty-state message when there are no claims', () => {
    render(<ClaimsTracker claims={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent(/no claims/i);
  });
});
