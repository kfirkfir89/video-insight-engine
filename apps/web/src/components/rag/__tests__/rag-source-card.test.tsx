import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RAGSourceCard } from '../RAGSourceCard';

describe('RAGSourceCard', () => {
  const defaultProps = {
    title: 'How to Learn Programming',
    youtubeId: 'abc123xyz',
  };

  describe('rendering', () => {
    it('should render title', () => {
      render(<RAGSourceCard {...defaultProps} />);

      expect(screen.getByText('How to Learn Programming')).toBeInTheDocument();
    });

    it('should render thumbnail image', () => {
      const { container } = render(<RAGSourceCard {...defaultProps} />);

      const img = container.querySelector('img');
      expect(img).toHaveAttribute(
        'src',
        'https://img.youtube.com/vi/abc123xyz/mqdefault.jpg'
      );
    });

    it('should use custom thumbnail when provided', () => {
      const { container } = render(
        <RAGSourceCard {...defaultProps} thumbnailUrl="https://example.com/custom.jpg" />
      );

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('src', 'https://example.com/custom.jpg');
    });

    it('should apply custom className', () => {
      const { container } = render(
        <RAGSourceCard {...defaultProps} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('timestamp display', () => {
    it('should render timestamp when provided', () => {
      render(<RAGSourceCard {...defaultProps} timestamp="1:23" />);

      expect(screen.getByText('1:23')).toBeInTheDocument();
    });

    it('should not render timestamp when not provided', () => {
      render(<RAGSourceCard {...defaultProps} />);

      // No timestamp badge should be visible
      const timestampBadge = document.querySelector('.absolute.bottom-0');
      expect(timestampBadge).toBeNull();
    });
  });

  describe('YouTube link', () => {
    it('should link to YouTube video', () => {
      render(<RAGSourceCard {...defaultProps} />);

      const openLink = screen.getByRole('link', { name: /open/i });
      expect(openLink).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abc123xyz');
    });

    it('should include timestamp in YouTube link when provided', () => {
      render(<RAGSourceCard {...defaultProps} timestampSeconds={120} />);

      const openLink = screen.getByRole('link', { name: /open/i });
      expect(openLink).toHaveAttribute(
        'href',
        'https://www.youtube.com/watch?v=abc123xyz&t=120s'
      );
    });

    it('should open YouTube link in new tab', () => {
      render(<RAGSourceCard {...defaultProps} />);

      const openLink = screen.getByRole('link', { name: /open/i });
      expect(openLink).toHaveAttribute('target', '_blank');
      expect(openLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('Jump to functionality', () => {
    it('should show "Jump to" button when onSeek and timestampSeconds provided', () => {
      const onSeek = vi.fn();
      render(
        <RAGSourceCard {...defaultProps} onSeek={onSeek} timestampSeconds={120} />
      );

      expect(screen.getByRole('button', { name: /jump to/i })).toBeInTheDocument();
    });

    it('should not show "Jump to" button when onSeek not provided', () => {
      render(<RAGSourceCard {...defaultProps} timestampSeconds={120} />);

      expect(screen.queryByRole('button', { name: /jump to/i })).not.toBeInTheDocument();
    });

    it('should not show "Jump to" button when timestampSeconds not provided', () => {
      const onSeek = vi.fn();
      render(<RAGSourceCard {...defaultProps} onSeek={onSeek} />);

      expect(screen.queryByRole('button', { name: /jump to/i })).not.toBeInTheDocument();
    });

    it('should call onSeek with timestampSeconds when clicked', () => {
      const onSeek = vi.fn();
      render(
        <RAGSourceCard {...defaultProps} onSeek={onSeek} timestampSeconds={120} />
      );

      fireEvent.click(screen.getByRole('button', { name: /jump to/i }));

      expect(onSeek).toHaveBeenCalledWith(120);
    });
  });

  describe('relevance score', () => {
    it('should display relevance score when provided', () => {
      render(<RAGSourceCard {...defaultProps} relevanceScore={0.85} />);

      expect(screen.getByText('85% match')).toBeInTheDocument();
    });

    it('should round relevance score', () => {
      render(<RAGSourceCard {...defaultProps} relevanceScore={0.856} />);

      expect(screen.getByText('86% match')).toBeInTheDocument();
    });

    it('should not display relevance score when not provided', () => {
      render(<RAGSourceCard {...defaultProps} />);

      expect(screen.queryByText(/match/)).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have aria-hidden on icons', () => {
      const { container } = render(
        <RAGSourceCard {...defaultProps} onSeek={vi.fn()} timestampSeconds={120} />
      );

      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should have lazy loading on thumbnail', () => {
      const { container } = render(<RAGSourceCard {...defaultProps} />);

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('loading', 'lazy');
    });
  });
});
