import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IngredientBlock } from '../IngredientBlock';
import type { IngredientBlock as IngredientBlockType } from '@vie/types';

const createMockBlock = (overrides: Partial<IngredientBlockType> = {}): IngredientBlockType => ({
  type: 'ingredient',
  blockId: 'block-1',
  items: [
    { name: 'Flour', amount: '2', unit: 'cups' },
    { name: 'Sugar', amount: '1', unit: 'cup' },
    { name: 'Salt', amount: '1/2', unit: 'tsp', notes: 'optional' },
  ],
  servings: 4,
  ...overrides,
});

describe('IngredientBlock', () => {
  describe('rendering', () => {
    it('should render ingredient list', () => {
      render(<IngredientBlock block={createMockBlock()} />);

      expect(screen.getByText('Flour')).toBeInTheDocument();
      expect(screen.getByText('Sugar')).toBeInTheDocument();
      expect(screen.getByText('Salt')).toBeInTheDocument();
    });

    it('should render amounts and units', () => {
      render(<IngredientBlock block={createMockBlock()} />);

      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('cups')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('cup')).toBeInTheDocument();
    });

    it('should render notes when present', () => {
      render(<IngredientBlock block={createMockBlock()} />);

      expect(screen.getByText('(optional)')).toBeInTheDocument();
    });

    it('should return null for empty items', () => {
      const { container } = render(<IngredientBlock block={createMockBlock({ items: [] })} />);
      expect(container.firstChild).toBeNull();
    });

    it('should have accessible list role', () => {
      render(<IngredientBlock block={createMockBlock()} />);
      expect(screen.getByRole('list')).toBeInTheDocument();
    });
  });

  describe('checkbox functionality', () => {
    it('should toggle ingredient checked state', () => {
      render(<IngredientBlock block={createMockBlock()} />);

      const checkButton = screen.getByRole('button', { name: /check flour/i });
      fireEvent.click(checkButton);

      expect(screen.getByRole('button', { name: /uncheck flour/i })).toBeInTheDocument();
    });

    it('should apply strikethrough style when checked', () => {
      render(<IngredientBlock block={createMockBlock()} />);

      const checkButton = screen.getByRole('button', { name: /check flour/i });
      fireEvent.click(checkButton);

      const flourText = screen.getByText('Flour');
      expect(flourText.parentElement).toHaveClass('line-through');
    });

    it('should uncheck previously checked item', () => {
      render(<IngredientBlock block={createMockBlock()} />);

      const checkButton = screen.getByRole('button', { name: /check flour/i });
      fireEvent.click(checkButton); // Check
      fireEvent.click(screen.getByRole('button', { name: /uncheck flour/i })); // Uncheck

      expect(screen.getByRole('button', { name: /check flour/i })).toBeInTheDocument();
    });
  });

  describe('serving scaler', () => {
    it('should display current servings', () => {
      render(<IngredientBlock block={createMockBlock({ servings: 4 })} />);

      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('should increase servings when plus button clicked', () => {
      render(<IngredientBlock block={createMockBlock({ servings: 4 })} />);

      const increaseButton = screen.getByRole('button', { name: /increase servings/i });
      fireEvent.click(increaseButton);

      expect(screen.getByText('6')).toBeInTheDocument(); // 4 * 1.5 = 6
    });

    it('should decrease servings when minus button clicked', () => {
      render(<IngredientBlock block={createMockBlock({ servings: 4 })} />);

      const decreaseButton = screen.getByRole('button', { name: /decrease servings/i });
      fireEvent.click(decreaseButton);

      expect(screen.getByText('2')).toBeInTheDocument(); // 4 * 0.5 = 2
    });

    it('should disable decrease button at minimum', () => {
      render(<IngredientBlock block={createMockBlock({ servings: 4 })} />);

      const decreaseButton = screen.getByRole('button', { name: /decrease servings/i });
      fireEvent.click(decreaseButton); // 0.5x

      expect(decreaseButton).toBeDisabled();
    });

    it('should scale numeric amounts', () => {
      render(<IngredientBlock block={createMockBlock({ servings: 4 })} />);

      const increaseButton = screen.getByRole('button', { name: /increase servings/i });
      fireEvent.click(increaseButton); // 1.5x

      expect(screen.getByText('3')).toBeInTheDocument(); // 2 cups flour → 3 cups
    });

    it('should scale fractional amounts', () => {
      render(<IngredientBlock block={createMockBlock({ servings: 4 })} />);

      const increaseButton = screen.getByRole('button', { name: /increase servings/i });
      fireEvent.click(increaseButton); // 1.5x

      expect(screen.getByText('0.8')).toBeInTheDocument(); // 1/2 tsp → 0.75 ≈ 0.8
    });
  });

  describe('pre-checked items', () => {
    it('should show item as checked if checked in data', () => {
      render(
        <IngredientBlock
          block={createMockBlock({
            items: [{ name: 'Flour', amount: '2', unit: 'cups', checked: true }],
          })}
        />
      );

      expect(screen.getByRole('button', { name: /uncheck flour/i })).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have accessible labels on buttons', () => {
      render(<IngredientBlock block={createMockBlock()} />);

      expect(screen.getByRole('button', { name: /increase servings/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /decrease servings/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /check flour/i })).toBeInTheDocument();
    });

    it('should have aria-hidden on icons', () => {
      const { container } = render(<IngredientBlock block={createMockBlock()} />);
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });
});
