import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { StatBanner } from '../StatBanner';

const stats = [
  { label: 'Duration', value: '12 min', emoji: '⏱️' },
  { label: 'Steps', value: '8' },
];

describe('StatBanner', () => {
  it('renders each stat label and value', () => {
    render(<StatBanner stats={stats} />);
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('12 min')).toBeInTheDocument();
    expect(screen.getByText('Steps')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('exposes stats as a labelled list', () => {
    render(<StatBanner stats={stats} />);
    const list = screen.getByRole('list', { name: /key stats/i });
    expect(list).toBeInTheDocument();
  });

  it('renders nothing when no stat has both a label and value', () => {
    const { container } = render(
      <StatBanner stats={[{ label: '', value: '' }, { label: 'X', value: '' }]} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for an empty stats array', () => {
    const { container } = render(<StatBanner stats={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
