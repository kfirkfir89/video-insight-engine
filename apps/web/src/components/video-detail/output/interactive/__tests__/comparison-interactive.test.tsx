import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';


import { ComparisonInteractive } from '../ComparisonInteractive';

const comparisons = [
  { feature: 'Battery', thisProduct: '4000mAh', competitor: '3500mAh', competitorName: 'Brand X' },
  { feature: 'Display', thisProduct: 'OLED', competitor: 'LCD', competitorName: 'Brand X' },
];

describe('ComparisonInteractive', () => {
  it('should render table comparison', () => {
    render(<ComparisonInteractive comparisons={comparisons} type="table" />);
    expect(screen.getByText('Feature')).toBeInTheDocument();
    expect(screen.getByText('Battery')).toBeInTheDocument();
    expect(screen.getByText('4000mAh')).toBeInTheDocument();
    expect(screen.getByText('Brand X')).toBeInTheDocument();
  });

  it('should return null when no data', () => {
    const { container } = render(<ComparisonInteractive />);
    expect(container.innerHTML).toBe('');
  });

  it('should render pros and cons', () => {
    render(<ComparisonInteractive pros={['Fast', 'Durable']} cons={['Expensive']} />);
    expect(screen.getByText('Go for it if...')).toBeInTheDocument();
    expect(screen.getByText('Fast')).toBeInTheDocument();
    expect(screen.getByText('Skip it if...')).toBeInTheDocument();
    expect(screen.getByText('Expensive')).toBeInTheDocument();
  });

  it('should render versus mode', () => {
    render(<ComparisonInteractive comparisons={comparisons} type="versus" />);
    expect(screen.getByText('Battery')).toBeInTheDocument();
    // "This Product" appears once per comparison row
    const thisProductEls = screen.getAllByText('This Product');
    expect(thisProductEls.length).toBeGreaterThanOrEqual(1);
  });
});
