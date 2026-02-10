import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TranscriptBlock } from '../TranscriptBlock';
import type { TranscriptBlock as TranscriptBlockType } from '@vie/types';

const createMockBlock = (
  overrides: Partial<TranscriptBlockType> = {}
): TranscriptBlockType => ({
  type: 'transcript',
  blockId: 'block-1',
  lines: [
    { time: '0:00', seconds: 0, text: 'First line' },
    { time: '0:30', seconds: 30, text: 'Second line' },
    { time: '1:00', seconds: 60, text: 'Third line' },
  ],
  ...overrides,
});

describe('TranscriptBlock', () => {
  describe('rendering', () => {
    it('should render transcript lines', () => {
      render(<TranscriptBlock block={createMockBlock()} />);

      expect(screen.getByText('First line')).toBeInTheDocument();
      expect(screen.getByText('Second line')).toBeInTheDocument();
      expect(screen.getByText('Third line')).toBeInTheDocument();
    });

    it('should render timestamps', () => {
      render(<TranscriptBlock block={createMockBlock()} />);

      expect(screen.getByText('0:00')).toBeInTheDocument();
      expect(screen.getByText('0:30')).toBeInTheDocument();
      expect(screen.getByText('1:00')).toBeInTheDocument();
    });

    it('should return null for empty lines', () => {
      const { container } = render(<TranscriptBlock block={createMockBlock({ lines: [] })} />);
      expect(container.firstChild).toBeNull();
    });

    it('should return null for undefined lines', () => {
      const { container } = render(
        <TranscriptBlock block={{ type: 'transcript' } as TranscriptBlockType} />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('expansion', () => {
    it('should show only first 5 lines by default', () => {
      const lines = Array.from({ length: 10 }, (_, i) => ({
        time: `${i}:00`,
        seconds: i * 60,
        text: `Line ${i + 1}`,
      }));

      render(<TranscriptBlock block={createMockBlock({ lines })} />);

      expect(screen.getByText('Line 1')).toBeInTheDocument();
      expect(screen.getByText('Line 5')).toBeInTheDocument();
      expect(screen.queryByText('Line 6')).not.toBeInTheDocument();
    });

    it('should show "Show more" button when there are more than 5 lines', () => {
      const lines = Array.from({ length: 10 }, (_, i) => ({
        time: `${i}:00`,
        seconds: i * 60,
        text: `Line ${i + 1}`,
      }));

      render(<TranscriptBlock block={createMockBlock({ lines })} />);

      expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument();
    });

    it('should not show "Show more" button when 5 or fewer lines', () => {
      render(<TranscriptBlock block={createMockBlock()} />);

      expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument();
    });

    it('should show all lines when expanded', () => {
      const lines = Array.from({ length: 10 }, (_, i) => ({
        time: `${i}:00`,
        seconds: i * 60,
        text: `Line ${i + 1}`,
      }));

      render(<TranscriptBlock block={createMockBlock({ lines })} />);

      fireEvent.click(screen.getByRole('button', { name: /show more/i }));

      expect(screen.getByText('Line 6')).toBeInTheDocument();
      expect(screen.getByText('Line 10')).toBeInTheDocument();
    });

    it('should show "Show less" button when expanded', () => {
      const lines = Array.from({ length: 10 }, (_, i) => ({
        time: `${i}:00`,
        seconds: i * 60,
        text: `Line ${i + 1}`,
      }));

      render(<TranscriptBlock block={createMockBlock({ lines })} />);

      fireEvent.click(screen.getByRole('button', { name: /show more/i }));

      expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument();
    });

    it('should collapse when "Show less" is clicked', () => {
      const lines = Array.from({ length: 10 }, (_, i) => ({
        time: `${i}:00`,
        seconds: i * 60,
        text: `Line ${i + 1}`,
      }));

      render(<TranscriptBlock block={createMockBlock({ lines })} />);

      // Expand
      fireEvent.click(screen.getByRole('button', { name: /show more/i }));
      expect(screen.getByText('Line 10')).toBeInTheDocument();

      // Collapse
      fireEvent.click(screen.getByRole('button', { name: /show less/i }));
      expect(screen.queryByText('Line 10')).not.toBeInTheDocument();
    });
  });

  describe('timestamp interaction', () => {
    it('should call onPlay when timestamp is clicked', () => {
      const onPlay = vi.fn();
      render(<TranscriptBlock block={createMockBlock()} onPlay={onPlay} />);

      const timestampButton = screen.getByRole('button', { name: /jump to 0:30/i });
      fireEvent.click(timestampButton);

      expect(onPlay).toHaveBeenCalledTimes(1);
      expect(onPlay).toHaveBeenCalledWith(30);
    });

    it('should call onSeek when onPlay is not provided', () => {
      const onSeek = vi.fn();
      render(<TranscriptBlock block={createMockBlock()} onSeek={onSeek} />);

      const timestampButton = screen.getByRole('button', { name: /jump to 1:00/i });
      fireEvent.click(timestampButton);

      expect(onSeek).toHaveBeenCalledTimes(1);
      expect(onSeek).toHaveBeenCalledWith(60);
    });

    it('should prefer onPlay over onSeek when both provided', () => {
      const onPlay = vi.fn();
      const onSeek = vi.fn();
      render(<TranscriptBlock block={createMockBlock()} onPlay={onPlay} onSeek={onSeek} />);

      const timestampButton = screen.getByRole('button', { name: /jump to 0:00/i });
      fireEvent.click(timestampButton);

      expect(onPlay).toHaveBeenCalledTimes(1);
      expect(onSeek).not.toHaveBeenCalled();
    });
  });

  describe('active line highlighting', () => {
    it('should highlight active line based on activeSeconds', () => {
      const lines = [
        { time: '0:00', seconds: 0, text: 'First' },
        { time: '0:30', seconds: 30, text: 'Second' },
        { time: '1:00', seconds: 60, text: 'Third' },
      ];

      const { container } = render(<TranscriptBlock block={createMockBlock({ lines })} activeSeconds={35} />);

      // The second line should be highlighted (35 seconds is between 30 and 60)
      const highlightedDiv = container.querySelector('.bg-info-soft');
      expect(highlightedDiv).toBeInTheDocument();
      expect(highlightedDiv).toHaveTextContent('Second');
    });

    it('should highlight first line when activeSeconds is 0', () => {
      const { container } = render(<TranscriptBlock block={createMockBlock()} activeSeconds={0} />);

      const highlightedDiv = container.querySelector('.bg-info-soft');
      expect(highlightedDiv).toBeInTheDocument();
      expect(highlightedDiv).toHaveTextContent('First line');
    });
  });

  describe('accessibility', () => {
    it('should have accessible labels on timestamp buttons', () => {
      render(<TranscriptBlock block={createMockBlock()} />);

      expect(screen.getByRole('button', { name: /jump to 0:00/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /jump to 0:30/i })).toBeInTheDocument();
    });

    it('should have aria-hidden on icons', () => {
      render(<TranscriptBlock block={createMockBlock()} />);

      const icons = document.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });
});
