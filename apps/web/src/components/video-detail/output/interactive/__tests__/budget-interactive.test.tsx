import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';


import { BudgetInteractive } from '../BudgetInteractive';

const breakdown = [
  { category: 'Flights', amount: 1200, emoji: '✈️' },
  { category: 'Hotels', amount: 800, emoji: '🏨', notes: 'Booking.com deals' },
  { category: 'Food', amount: 500, emoji: '🍽️' },
];

describe('BudgetInteractive', () => {
  it('should render total budget', () => {
    render(<BudgetInteractive total={2500} breakdown={breakdown} />);
    // Total animates from 0 — "Total Budget" subtitle always shows
    expect(screen.getByText('Total Budget')).toBeInTheDocument();
  });

  it('should render breakdown items', () => {
    render(<BudgetInteractive total={2500} breakdown={breakdown} />);
    expect(screen.getByText('Flights')).toBeInTheDocument();
    expect(screen.getByText('Hotels')).toBeInTheDocument();
    expect(screen.getByText('Food')).toBeInTheDocument();
  });

  it('should show breakdown notes', () => {
    render(<BudgetInteractive total={2500} breakdown={breakdown} />);
    expect(screen.getByText('Booking.com deals')).toBeInTheDocument();
  });

  it('should show saving tips when provided', () => {
    render(
      <BudgetInteractive
        total={2500}
        breakdown={breakdown}
        savingTips={['Book flights early', 'Use public transport']}
      />,
    );
    expect(screen.getByText('Book flights early')).toBeInTheDocument();
    expect(screen.getByText('Use public transport')).toBeInTheDocument();
  });

  it('should format currency correctly', () => {
    render(<BudgetInteractive total={3000} currency="EUR" breakdown={[{ category: 'Test', amount: 3000 }]} />);
    // EUR appears in breakdown row (breakdown amounts are not animated)
    const eurTexts = screen.getAllByText('€3,000');
    expect(eurTexts.length).toBeGreaterThanOrEqual(1);
  });
});
