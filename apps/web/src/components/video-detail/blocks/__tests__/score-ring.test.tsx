import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreRing } from '../ScoreRing';

describe('ScoreRing', () => {
  describe('rendering', () => {
    it('should render percentage display when maxScore is 100', () => {
      render(<ScoreRing score={75} maxScore={100} />);

      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should render rating display when maxScore is 10', () => {
      render(<ScoreRing score={8.5} maxScore={10} />);

      expect(screen.getByText('8.5')).toBeInTheDocument();
    });

    it('should render fraction display for other maxScores', () => {
      render(<ScoreRing score={3} maxScore={5} />);

      expect(screen.getByText('3/5')).toBeInTheDocument();
    });

    it('should render label when provided', () => {
      render(<ScoreRing score={90} label="Performance" />);

      expect(screen.getByText('Performance')).toBeInTheDocument();
    });

    it('should have accessible aria-label', () => {
      render(<ScoreRing score={85} maxScore={100} label="Grade" />);

      expect(screen.getByRole('img')).toHaveAttribute(
        'aria-label',
        'Score: 85% \u2014 Grade'
      );
    });
  });

  describe('clamping', () => {
    it('should clamp score to maxScore', () => {
      render(<ScoreRing score={150} maxScore={100} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should clamp negative score to 0', () => {
      render(<ScoreRing score={-10} maxScore={100} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  describe('SVG rendering', () => {
    it('should render two SVG circles', () => {
      const { container } = render(<ScoreRing score={50} />);

      const circles = container.querySelectorAll('circle');
      expect(circles).toHaveLength(2);
    });

    it('should render correct size for sm variant', () => {
      const { container } = render(<ScoreRing score={50} size="sm" />);

      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '64');
    });

    it('should render correct size for lg variant', () => {
      const { container } = render(<ScoreRing score={50} size="lg" />);

      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '128');
    });
  });

  describe('edge cases', () => {
    it('should handle zero maxScore without crashing', () => {
      render(<ScoreRing score={0} maxScore={0} />);

      expect(screen.getByText('0/0')).toBeInTheDocument();
    });

    it('should default maxScore to 100', () => {
      render(<ScoreRing score={50} />);

      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });
});
