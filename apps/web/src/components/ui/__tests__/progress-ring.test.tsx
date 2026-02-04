import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressRing } from '../progress-ring';

describe('ProgressRing', () => {
  describe('rendering', () => {
    it('should render with default props', () => {
      render(<ProgressRing value={50} />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should render with custom size', () => {
      render(<ProgressRing value={50} size={64} />);
      const svg = screen.getByRole('progressbar').querySelector('svg');
      expect(svg).toHaveAttribute('width', '64');
      expect(svg).toHaveAttribute('height', '64');
    });

    it('should render percentage text when showValue is true', () => {
      render(<ProgressRing value={75} showValue />);
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should not render percentage text when showValue is false', () => {
      render(<ProgressRing value={75} showValue={false} />);
      expect(screen.queryByText('75%')).not.toBeInTheDocument();
    });
  });

  describe('value handling', () => {
    it('should clamp value at minimum 0', () => {
      render(<ProgressRing value={-10} showValue />);
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should clamp value at maximum 100', () => {
      render(<ProgressRing value={150} showValue />);
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should round displayed percentage', () => {
      render(<ProgressRing value={33.7} showValue />);
      expect(screen.getByText('34%')).toBeInTheDocument();
    });

    it('should handle 0% progress', () => {
      render(<ProgressRing value={0} showValue />);
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should handle 100% progress', () => {
      render(<ProgressRing value={100} showValue />);
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  describe('SVG structure', () => {
    it('should render background circle', () => {
      render(<ProgressRing value={50} />);
      const circles = screen.getByRole('progressbar').querySelectorAll('circle');
      expect(circles).toHaveLength(2);
    });

    it('should apply correct viewBox', () => {
      render(<ProgressRing value={50} size={100} />);
      const svg = screen.getByRole('progressbar').querySelector('svg');
      expect(svg).toHaveAttribute('viewBox', '0 0 100 100');
    });

    it('should calculate correct radius', () => {
      render(<ProgressRing value={50} size={48} strokeWidth={4} />);
      const circle = screen.getByRole('progressbar').querySelectorAll('circle')[0];
      // radius = (48 - 4) / 2 = 22
      expect(circle).toHaveAttribute('r', '22');
    });

    it('should apply custom strokeWidth', () => {
      render(<ProgressRing value={50} strokeWidth={8} />);
      const circles = screen.getByRole('progressbar').querySelectorAll('circle');
      circles.forEach(circle => {
        expect(circle).toHaveAttribute('stroke-width', '8');
      });
    });
  });

  describe('colors', () => {
    it('should apply custom color', () => {
      render(<ProgressRing value={50} color="#ff0000" />);
      const progressCircle = screen.getByRole('progressbar').querySelectorAll('circle')[1];
      expect(progressCircle).toHaveAttribute('stroke', '#ff0000');
    });

    it('should apply custom background color', () => {
      render(<ProgressRing value={50} bgColor="#cccccc" />);
      const bgCircle = screen.getByRole('progressbar').querySelectorAll('circle')[0];
      expect(bgCircle).toHaveAttribute('stroke', '#cccccc');
    });
  });

  describe('accessibility', () => {
    it('should have progressbar role', () => {
      render(<ProgressRing value={50} />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should have aria-valuenow', () => {
      render(<ProgressRing value={75} />);
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');
    });

    it('should have aria-valuemin', () => {
      render(<ProgressRing value={50} />);
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemin', '0');
    });

    it('should have aria-valuemax', () => {
      render(<ProgressRing value={50} />);
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '100');
    });

    it('should have default aria-label', () => {
      render(<ProgressRing value={50} />);
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-label', '50% complete');
    });

    it('should accept custom label', () => {
      render(<ProgressRing value={50} label="Upload progress" />);
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-label', 'Upload progress');
    });

    it('should clamp aria-valuenow for negative values', () => {
      render(<ProgressRing value={-10} />);
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    });

    it('should clamp aria-valuenow for values over 100', () => {
      render(<ProgressRing value={150} />);
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    });
  });

  describe('custom className', () => {
    it('should apply custom className', () => {
      render(<ProgressRing value={50} className="custom-class" />);
      expect(screen.getByRole('progressbar')).toHaveClass('custom-class');
    });
  });
});
