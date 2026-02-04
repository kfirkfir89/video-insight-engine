import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExpandableText } from '../expandable-text';

// Mock scrollHeight/clientHeight for truncation detection
const mockScrollHeight = (height: number) => {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    value: height,
  });
};

const mockClientHeight = (height: number) => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    value: height,
  });
};

describe('ExpandableText', () => {
  describe('rendering', () => {
    it('should render text content', () => {
      render(<ExpandableText text="Hello world" />);
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(<ExpandableText text="Test" className="custom-class" />);
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should render with default line clamp of 3', () => {
      render(<ExpandableText text="Test text" />);
      const paragraph = screen.getByText('Test text');
      expect(paragraph).toHaveClass('line-clamp-3');
    });
  });

  describe('line clamp options', () => {
    it('should apply line-clamp-1 for lineClamp=1', () => {
      render(<ExpandableText text="Test" lineClamp={1} />);
      expect(screen.getByText('Test')).toHaveClass('line-clamp-1');
    });

    it('should apply line-clamp-2 for lineClamp=2', () => {
      render(<ExpandableText text="Test" lineClamp={2} />);
      expect(screen.getByText('Test')).toHaveClass('line-clamp-2');
    });

    it('should apply line-clamp-4 for lineClamp=4', () => {
      render(<ExpandableText text="Test" lineClamp={4} />);
      expect(screen.getByText('Test')).toHaveClass('line-clamp-4');
    });

    it('should apply line-clamp-5 for lineClamp=5', () => {
      render(<ExpandableText text="Test" lineClamp={5} />);
      expect(screen.getByText('Test')).toHaveClass('line-clamp-5');
    });

    it('should apply line-clamp-6 for lineClamp=6', () => {
      render(<ExpandableText text="Test" lineClamp={6} />);
      expect(screen.getByText('Test')).toHaveClass('line-clamp-6');
    });

    it('should fallback to line-clamp-3 for unsupported values', () => {
      render(<ExpandableText text="Test" lineClamp={10} />);
      expect(screen.getByText('Test')).toHaveClass('line-clamp-3');
    });
  });

  describe('truncation detection', () => {
    it('should show expand button when text is truncated', () => {
      mockScrollHeight(200);
      mockClientHeight(60);

      render(<ExpandableText text="Long text that should be truncated" />);

      expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument();
    });

    it('should not show expand button when text fits', () => {
      mockScrollHeight(50);
      mockClientHeight(60);

      render(<ExpandableText text="Short text" />);

      expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument();
    });
  });

  describe('expand/collapse behavior', () => {
    beforeEach(() => {
      mockScrollHeight(200);
      mockClientHeight(60);
    });

    it('should expand when clicking show more button', () => {
      render(<ExpandableText text="Expandable text content" expandLabel="Show more" />);

      const button = screen.getByRole('button', { name: /show more/i });
      fireEvent.click(button);

      expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument();
    });

    it('should collapse when clicking show less button', () => {
      render(<ExpandableText text="Expandable text content" />);

      // Expand first
      fireEvent.click(screen.getByRole('button', { name: /show more/i }));

      // Then collapse
      fireEvent.click(screen.getByRole('button', { name: /show less/i }));

      expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument();
    });

    it('should remove line clamp class when expanded', () => {
      render(<ExpandableText text="Expandable text content" />);

      const text = screen.getByText('Expandable text content');
      expect(text).toHaveClass('line-clamp-3');

      fireEvent.click(screen.getByRole('button', { name: /show more/i }));

      expect(text).not.toHaveClass('line-clamp-3');
    });

    it('should add line clamp class when collapsed', () => {
      render(<ExpandableText text="Expandable text content" />);

      // Expand
      fireEvent.click(screen.getByRole('button', { name: /show more/i }));

      const text = screen.getByText('Expandable text content');
      expect(text).not.toHaveClass('line-clamp-3');

      // Collapse
      fireEvent.click(screen.getByRole('button', { name: /show less/i }));

      expect(text).toHaveClass('line-clamp-3');
    });
  });

  describe('custom labels', () => {
    beforeEach(() => {
      mockScrollHeight(200);
      mockClientHeight(60);
    });

    it('should use custom expandLabel', () => {
      render(<ExpandableText text="Test" expandLabel="Read more" />);
      expect(screen.getByRole('button', { name: /read more/i })).toBeInTheDocument();
    });

    it('should use custom collapseLabel', () => {
      render(<ExpandableText text="Test" collapseLabel="Read less" />);

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByRole('button', { name: /read less/i })).toBeInTheDocument();
    });
  });

  describe('defaultExpanded', () => {
    beforeEach(() => {
      mockScrollHeight(200);
      mockClientHeight(60);
    });

    it('should start expanded when defaultExpanded is true', () => {
      render(<ExpandableText text="Test content" defaultExpanded />);

      const text = screen.getByText('Test content');
      expect(text).not.toHaveClass('line-clamp-3');

      // Should show collapse button
      expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument();
    });

    it('should start collapsed when defaultExpanded is false', () => {
      render(<ExpandableText text="Test content" defaultExpanded={false} />);

      const text = screen.getByText('Test content');
      expect(text).toHaveClass('line-clamp-3');
    });
  });

  describe('accessibility', () => {
    beforeEach(() => {
      mockScrollHeight(200);
      mockClientHeight(60);
    });

    it('should have button type', () => {
      render(<ExpandableText text="Test" />);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    });

    it('should have aria-hidden on icons', () => {
      render(<ExpandableText text="Test" />);
      const icons = screen.getByRole('button').querySelectorAll('svg');
      icons.forEach(icon => {
        expect(icon).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });
});
