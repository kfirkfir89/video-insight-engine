import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';


import { ComparisonInteractive, scoreComparisonAxes } from '../ComparisonInteractive';

const comparisons = [
  { feature: 'Battery', thisProduct: '4000mAh', competitor: '3500mAh', competitorName: 'Brand X' },
  { feature: 'Display', thisProduct: 'OLED', competitor: 'LCD', competitorName: 'Brand X' },
];

// Four scoreable axes — enough to trigger the radar hero (≥3).
const radarRows = [
  { feature: 'Camera', thisProduct: '48', competitor: '50', competitorName: 'Galaxy S24', winner: 'right' as const },
  { feature: 'Battery', thisProduct: '4422', competitor: '4000', competitorName: 'Galaxy S24', winner: 'left' as const },
  { feature: 'Display', thisProduct: '120', competitor: '120', competitorName: 'Galaxy S24', winner: 'tie' as const },
  { feature: 'Weight', thisProduct: '187', competitor: '227', competitorName: 'Galaxy S24', winner: 'left' as const },
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

  it('should render ReviewSummary header with bottomLine, bestFor and notFor when verdict is provided', () => {
    render(
      <ComparisonInteractive
        comparisons={comparisons}
        verdict={{
          badge: 'recommended',
          bottomLine: 'A solid upgrade for most users.',
          bestFor: ['Power users', 'Photographers'],
          notFor: ['Budget shoppers'],
          score: 8,
          maxScore: 10,
        }}
      />,
    );
    expect(screen.getByText('A solid upgrade for most users.')).toBeInTheDocument();
    expect(screen.getByText('Best For')).toBeInTheDocument();
    expect(screen.getByText('Power users')).toBeInTheDocument();
    expect(screen.getByText('Not For')).toBeInTheDocument();
    expect(screen.getByText('Budget shoppers')).toBeInTheDocument();
    expect(screen.getByText('recommended')).toBeInTheDocument();
  });

  // ─── P3C: unified radar + table + verdict ───

  it('should show the radar hero AND the table when there are >=3 scoreable axes', () => {
    render(<ComparisonInteractive comparisons={radarRows} type="table" />);
    // Radar hero (winner badge is unique to the hero) + table header below.
    expect(screen.getByTestId('comparison-radar-winner-badge')).toBeInTheDocument();
    expect(screen.getByText('Feature')).toBeInTheDocument();
    expect(screen.getAllByText('Camera').length).toBeGreaterThanOrEqual(1);
  });

  it('should NOT show the radar hero with fewer than 3 axes', () => {
    render(<ComparisonInteractive comparisons={comparisons} type="table" />);
    expect(screen.queryByTestId('comparison-radar-winner-badge')).not.toBeInTheDocument();
    // Table still renders.
    expect(screen.getByText('Battery')).toBeInTheDocument();
  });

  it('should render the radar hero when view="radar" is forced (comparison_radar alias path)', () => {
    render(<ComparisonInteractive comparisons={radarRows} view="radar" />);
    expect(screen.getByTestId('comparison-radar-winner-badge')).toBeInTheDocument();
    // Per-axis weight sliders present (one per row).
    expect(screen.getByTestId('comparison-radar-weight-0')).toBeInTheDocument();
  });

  it('should suppress the radar hero when view="table" even with enough axes', () => {
    render(<ComparisonInteractive comparisons={radarRows} view="table" />);
    expect(screen.queryByTestId('comparison-radar-winner-badge')).not.toBeInTheDocument();
    expect(screen.getByText('Feature')).toBeInTheDocument();
  });

  describe('scoreComparisonAxes', () => {
    it('scales numeric sides so the larger is 10', () => {
      const scored = scoreComparisonAxes([
        { feature: 'Battery', thisProduct: '4000', competitor: '2000', competitorName: 'X' },
      ]);
      expect(scored[0].isNumeric).toBe(true);
      expect(scored[0].left).toBe(10);
      expect(scored[0].right).toBe(5);
    });

    it('falls back to winner-based scoring for non-numeric sides', () => {
      const scored = scoreComparisonAxes([
        { feature: 'Display', thisProduct: 'OLED', competitor: 'LCD', competitorName: 'X', winner: 'left' },
      ]);
      expect(scored[0].isNumeric).toBe(false);
      expect(scored[0].left).toBe(8);
      expect(scored[0].right).toBe(5);
    });
  });

  it('should NOT render ReviewSummary when verdict.bottomLine is empty/undefined', () => {
    render(
      <ComparisonInteractive
        comparisons={comparisons}
        verdict={{
          badge: 'recommended',
          bestFor: ['Power users'],
        }}
      />,
    );
    // Header pieces must NOT appear
    expect(screen.queryByText('Best For')).not.toBeInTheDocument();
    expect(screen.queryByText('Power users')).not.toBeInTheDocument();
    expect(screen.queryByText('recommended')).not.toBeInTheDocument();
    // Table still renders
    expect(screen.getByText('Battery')).toBeInTheDocument();
    expect(screen.getByText('Feature')).toBeInTheDocument();
  });
});
