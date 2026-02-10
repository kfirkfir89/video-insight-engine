import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CostBlock } from '../CostBlock';
import type { CostBlock as CostBlockType } from '@vie/types';

const createMockBlock = (overrides: Partial<CostBlockType> = {}): CostBlockType => ({
  type: 'cost',
  blockId: 'block-1',
  items: [
    { category: 'Flights', amount: 800 },
    { category: 'Accommodation', amount: 500, notes: '5 nights' },
    { category: 'Food', amount: 300 },
  ],
  currency: '$',
  ...overrides,
});

describe('CostBlock', () => {
  describe('rendering', () => {
    it('should render all cost items', () => {
      render(<CostBlock block={createMockBlock()} />);

      expect(screen.getByText('Flights')).toBeInTheDocument();
      expect(screen.getByText('Accommodation')).toBeInTheDocument();
      expect(screen.getByText('Food')).toBeInTheDocument();
    });

    it('should render amounts with currency', () => {
      render(<CostBlock block={createMockBlock()} />);

      expect(screen.getByText('$800')).toBeInTheDocument();
      expect(screen.getByText('$500')).toBeInTheDocument();
      expect(screen.getByText('$300')).toBeInTheDocument();
    });

    it('should render notes when present', () => {
      render(<CostBlock block={createMockBlock()} />);

      expect(screen.getByText('5 nights')).toBeInTheDocument();
    });

    it('should return null for empty items', () => {
      const { container } = render(<CostBlock block={createMockBlock({ items: [] })} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('total calculation', () => {
    it('should calculate and display total', () => {
      render(<CostBlock block={createMockBlock()} />);

      // 800 + 500 + 300 = 1600
      expect(screen.getByText('$1,600')).toBeInTheDocument();
    });

    it('should use explicit total when provided', () => {
      render(<CostBlock block={createMockBlock({ total: 2000 })} />);

      expect(screen.getByText('$2,000')).toBeInTheDocument();
    });
  });

  describe('currency', () => {
    it('should use default $ currency', () => {
      render(<CostBlock block={createMockBlock({ currency: undefined })} />);

      expect(screen.getByText('$800')).toBeInTheDocument();
    });

    it('should use custom currency', () => {
      render(<CostBlock block={createMockBlock({ currency: '€' })} />);

      expect(screen.getByText('€800')).toBeInTheDocument();
      expect(screen.getByText('€1,600')).toBeInTheDocument();
    });
  });

  describe('number formatting', () => {
    it('should format large numbers with commas', () => {
      render(
        <CostBlock
          block={createMockBlock({
            items: [{ category: 'Car', amount: 25000 }],
          })}
        />
      );

      // Amount appears in both row and total
      expect(screen.getAllByText('$25,000').length).toBeGreaterThan(0);
    });

    it('should show decimal places when needed', () => {
      render(
        <CostBlock
          block={createMockBlock({
            items: [{ category: 'Tip', amount: 15.5 }],
          })}
        />
      );

      // Amount appears in both row and total
      expect(screen.getAllByText('$15.5').length).toBeGreaterThan(0);
    });
  });

  describe('layout structure', () => {
    it('should render cost items as div rows', () => {
      const { container } = render(<CostBlock block={createMockBlock()} />);

      const rows = container.querySelectorAll('.flex.items-baseline.justify-between');
      expect(rows.length).toBeGreaterThan(1); // items + total
    });

    it('should have fade dividers between items', () => {
      const { container } = render(<CostBlock block={createMockBlock()} />);

      const dividers = container.querySelectorAll('.fade-divider');
      expect(dividers.length).toBeGreaterThan(0);
    });

    it('should display total row', () => {
      render(<CostBlock block={createMockBlock()} />);

      expect(screen.getByText('Total')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have aria-hidden on icons', () => {
      const { container } = render(<CostBlock block={createMockBlock()} />);
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should have aria-hidden on decorative dividers', () => {
      const { container } = render(<CostBlock block={createMockBlock()} />);

      const dividers = container.querySelectorAll('.fade-divider[aria-hidden="true"]');
      expect(dividers.length).toBeGreaterThan(0);
    });
  });
});
