import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimelineBlock } from '../TimelineBlock';
import type { TimelineBlock as TimelineBlockType } from '@vie/types';

const createMockBlock = (
  overrides: Partial<TimelineBlockType> = {}
): TimelineBlockType => ({
  type: 'timeline',
  blockId: 'block-1',
  events: [
    { date: '2024-01-01', title: 'First Event', description: 'Description 1' },
    { time: '10:00', title: 'Second Event', description: 'Description 2' },
    { title: 'Third Event' },
  ],
  ...overrides,
});

describe('TimelineBlock', () => {
  describe('rendering', () => {
    it('should render event titles', () => {
      render(<TimelineBlock block={createMockBlock()} />);

      expect(screen.getByText('First Event')).toBeInTheDocument();
      expect(screen.getByText('Second Event')).toBeInTheDocument();
      expect(screen.getByText('Third Event')).toBeInTheDocument();
    });

    it('should render event descriptions', () => {
      render(<TimelineBlock block={createMockBlock()} />);

      expect(screen.getByText('Description 1')).toBeInTheDocument();
      expect(screen.getByText('Description 2')).toBeInTheDocument();
    });

    it('should render dates', () => {
      render(<TimelineBlock block={createMockBlock()} />);

      expect(screen.getByText('2024-01-01')).toBeInTheDocument();
    });

    it('should render times', () => {
      render(<TimelineBlock block={createMockBlock()} />);

      expect(screen.getByText('10:00')).toBeInTheDocument();
    });

    it('should return null for empty events', () => {
      const { container } = render(
        <TimelineBlock block={createMockBlock({ events: [] })} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should return null for undefined events', () => {
      const { container } = render(
        <TimelineBlock block={{ type: 'timeline' } as TimelineBlockType} />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('event without metadata', () => {
    it('should render event with only title', () => {
      render(
        <TimelineBlock
          block={createMockBlock({
            events: [{ title: 'Title Only Event' }],
          })}
        />
      );

      expect(screen.getByText('Title Only Event')).toBeInTheDocument();
    });

    it('should handle events without descriptions', () => {
      render(
        <TimelineBlock
          block={createMockBlock({
            events: [
              { date: '2024-01-01', title: 'No Description' },
            ],
          })}
        />
      );

      expect(screen.getByText('No Description')).toBeInTheDocument();
      expect(screen.getByText('2024-01-01')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper structure', () => {
      const { container } = render(<TimelineBlock block={createMockBlock()} />);

      // Should have timeline visual elements (gradient line)
      expect(container.querySelector('.timeline-line')).toBeInTheDocument();
    });
  });
});
