import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NutritionBlock } from '../NutritionBlock';
import type { NutritionBlock as NutritionBlockType } from '@vie/types';

const createMockBlock = (overrides: Partial<NutritionBlockType> = {}): NutritionBlockType => ({
  type: 'nutrition',
  blockId: 'block-1',
  items: [
    { nutrient: 'Calories', amount: '250' },
    { nutrient: 'Protein', amount: '12', unit: 'g', dailyValue: '24%' },
    { nutrient: 'Fat', amount: '8', unit: 'g', dailyValue: '10%' },
    { nutrient: 'Carbs', amount: '35', unit: 'g' },
  ],
  servingSize: '1 cup (240g)',
  ...overrides,
});

describe('NutritionBlock', () => {
  describe('rendering', () => {
    it('should render all nutrients', () => {
      render(<NutritionBlock block={createMockBlock()} />);

      expect(screen.getByText('Calories')).toBeInTheDocument();
      expect(screen.getByText('Protein')).toBeInTheDocument();
      expect(screen.getByText('Fat')).toBeInTheDocument();
      expect(screen.getByText('Carbs')).toBeInTheDocument();
    });

    it('should render amounts', () => {
      render(<NutritionBlock block={createMockBlock()} />);

      expect(screen.getByText('250')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    it('should render units when present', () => {
      render(<NutritionBlock block={createMockBlock()} />);

      // Units are rendered inline with amounts
      const gUnits = screen.getAllByText('g');
      expect(gUnits.length).toBe(3); // Protein, Fat, Carbs
    });

    it('should render daily values when present', () => {
      render(<NutritionBlock block={createMockBlock()} />);

      expect(screen.getByText('24%')).toBeInTheDocument();
      expect(screen.getByText('10%')).toBeInTheDocument();
    });

    it('should return null for empty items', () => {
      const { container } = render(<NutritionBlock block={createMockBlock({ items: [] })} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('serving size', () => {
    it('should display serving size when present', () => {
      render(<NutritionBlock block={createMockBlock()} />);

      expect(screen.getByText(/1 cup \(240g\)/)).toBeInTheDocument();
    });

    it('should not display serving size when not present', () => {
      render(<NutritionBlock block={createMockBlock({ servingSize: undefined })} />);

      expect(screen.queryByText(/per serving/i)).not.toBeInTheDocument();
    });
  });

  describe('table structure', () => {
    it('should render as table element', () => {
      render(<NutritionBlock block={createMockBlock()} />);

      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('should have screen-reader only header row', () => {
      const { container } = render(<NutritionBlock block={createMockBlock()} />);

      const thead = container.querySelector('thead');
      expect(thead).toHaveClass('sr-only');
    });

    it('should have correct number of rows', () => {
      render(<NutritionBlock block={createMockBlock()} />);

      const rows = screen.getAllByRole('row');
      // 1 header row (sr-only) + 4 data rows
      expect(rows.length).toBe(5);
    });
  });

  describe('accessibility', () => {
    it('should have aria-hidden on icons', () => {
      const { container } = render(<NutritionBlock block={createMockBlock()} />);
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should have proper table semantics', () => {
      render(<NutritionBlock block={createMockBlock()} />);

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
    });
  });
});
