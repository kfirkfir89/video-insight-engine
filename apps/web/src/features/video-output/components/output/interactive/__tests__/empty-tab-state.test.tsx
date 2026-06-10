import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Wallet } from 'lucide-react';

import { EmptyTabState } from '../EmptyTabState';

describe('EmptyTabState', () => {
  it('renders the message', () => {
    render(<EmptyTabState message="No steps were extracted for this video." />);
    expect(
      screen.getByText('No steps were extracted for this video.'),
    ).toBeInTheDocument();
  });

  it('exposes the message as a live status region', () => {
    render(<EmptyTabState message="Nothing here." />);
    expect(screen.getByRole('status')).toHaveTextContent('Nothing here.');
  });

  it('renders the provided icon', () => {
    const { container } = render(
      <EmptyTabState message="No cost breakdown." icon={Wallet} />,
    );
    expect(container.querySelector('.lucide-wallet')).toBeInTheDocument();
  });

  it('falls back to a default icon when none is given', () => {
    const { container } = render(<EmptyTabState message="Empty." />);
    expect(container.querySelector('.lucide-inbox')).toBeInTheDocument();
  });
});
