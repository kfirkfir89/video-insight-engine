import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RatingBlock } from '../RatingBlock';
import type { RatingBlock as RatingBlockType } from '@vie/types';

const createMockBlock = (overrides: Partial<RatingBlockType> = {}): RatingBlockType => ({
  type: 'rating',
  blockId: 'block-1',
  score: 4,
  maxScore: 5,
  ...overrides,
});

describe('RatingBlock', () => {
  describe('rendering', () => {
    it('should render score', () => {
      render(<RatingBlock block={createMockBlock()} />);

      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('should render max score', () => {
      render(<RatingBlock block={createMockBlock()} />);

      expect(screen.getByText('/ 5')).toBeInTheDocument();
    });
  });

  describe('compact layout', () => {
    it('should render breakdown categories when breakdown exists', () => {
      render(
        <RatingBlock
          block={createMockBlock({
            breakdown: [
              { category: 'Performance', score: 4 },
              { category: 'Design', score: 5 },
            ],
          })}
        />
      );

      expect(screen.getByText('Performance')).toBeInTheDocument();
      expect(screen.getByText('Design')).toBeInTheDocument();
    });

    it('should not render breakdown section when no breakdown provided', () => {
      render(<RatingBlock block={createMockBlock()} />);

      expect(screen.queryByText('Performance')).not.toBeInTheDocument();
      expect(screen.queryByText('Design')).not.toBeInTheDocument();
    });
  });

  describe('star display (5-point scale)', () => {
    it('should render stars for 5-point scale', () => {
      const { container } = render(<RatingBlock block={createMockBlock({ score: 4, maxScore: 5 })} />);

      // Should have star SVGs
      const stars = container.querySelectorAll('svg');
      expect(stars.length).toBeGreaterThan(0);
    });

    it('should fill correct number of stars', () => {
      const { container } = render(<RatingBlock block={createMockBlock({ score: 3, maxScore: 5 })} />);

      // 3 filled stars should have fill class
      const filledStars = container.querySelectorAll('.fill-warning');
      expect(filledStars.length).toBe(3);
    });

    it('should render half star for .5 scores', () => {
      const { container } = render(<RatingBlock block={createMockBlock({ score: 3.5, maxScore: 5 })} />);

      // Should have StarHalf icon
      const filledStars = container.querySelectorAll('.fill-warning');
      expect(filledStars.length).toBe(4); // 3 full + 1 half
    });
  });

  describe('progress bar (larger scales)', () => {
    it('should render progress bar for 10-point scale', () => {
      const { container } = render(<RatingBlock block={createMockBlock({ score: 7, maxScore: 10 })} />);

      // Should not render stars but should have progress bar
      const progressBar = container.querySelector('[style*="width"]');
      expect(progressBar).toBeInTheDocument();
    });

    it('should render progress bar for 100-point scale', () => {
      const { container } = render(<RatingBlock block={createMockBlock({ score: 85, maxScore: 100 })} />);

      const scoreDisplay = screen.getByText('85/100');
      expect(scoreDisplay).toBeInTheDocument();
    });
  });

  describe('score clamping', () => {
    it('should clamp score to max', () => {
      render(<RatingBlock block={createMockBlock({ score: 10, maxScore: 5 })} />);

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should clamp negative scores to 0', () => {
      render(<RatingBlock block={createMockBlock({ score: -2, maxScore: 5 })} />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  describe('breakdown', () => {
    it('should render breakdown categories', () => {
      render(
        <RatingBlock
          block={createMockBlock({
            breakdown: [
              { category: 'Performance', score: 4 },
              { category: 'Design', score: 5 },
              { category: 'Value', score: 3 },
            ],
          })}
        />
      );

      expect(screen.getByText('Performance')).toBeInTheDocument();
      expect(screen.getByText('Design')).toBeInTheDocument();
      expect(screen.getByText('Value')).toBeInTheDocument();
    });

    it('should not render breakdown section when empty', () => {
      render(<RatingBlock block={createMockBlock({ breakdown: [] })} />);

      // No breakdown categories should be present
      expect(screen.queryByText('Performance')).not.toBeInTheDocument();
    });

    it('should render breakdown progress bars', () => {
      const { container } = render(
        <RatingBlock
          block={createMockBlock({
            breakdown: [{ category: 'Test', score: 3, maxScore: 5 }],
          })}
        />
      );

      // Breakdown section should have progress bars
      const progressBars = container.querySelectorAll('[class*="bg-"][class*="rounded-full"]');
      expect(progressBars.length).toBeGreaterThan(0);
    });
  });

  describe('accessibility', () => {
    it('should have accessible label on score', () => {
      const { container } = render(<RatingBlock block={createMockBlock({ score: 4, maxScore: 5 })} />);

      // The aria-label is "Rating: 4 out of 5" on the score element
      const labelledElement = container.querySelector('[aria-label]');
      expect(labelledElement?.getAttribute('aria-label')).toMatch(/rating.*4.*5/i);
    });

    it('should have aria-hidden on star icons', () => {
      const { container } = render(<RatingBlock block={createMockBlock()} />);

      const hiddenContainer = container.querySelector('[aria-hidden="true"]');
      expect(hiddenContainer).toBeInTheDocument();
    });
  });
});
