import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ItineraryBlock } from '../ItineraryBlock';
import type { ItineraryBlock as ItineraryBlockType } from '@vie/types';

const createMockBlock = (overrides: Partial<ItineraryBlockType> = {}): ItineraryBlockType => ({
  type: 'itinerary',
  blockId: 'block-1',
  days: [
    {
      day: 1,
      title: 'Arrival & Orientation',
      activities: [
        { activity: 'Airport arrival', time: '10:00', location: 'CDG Airport' },
        { activity: 'Hotel check-in', time: '13:00', location: 'Hotel Le Marais' },
        { activity: 'Evening walk', duration: '2 hours', notes: 'Explore the neighborhood' },
      ],
    },
    {
      day: 2,
      title: 'Sightseeing',
      activities: [
        { activity: 'Eiffel Tower', time: '09:00', duration: '3 hours' },
        { activity: 'Louvre Museum', time: '14:00', duration: '4 hours' },
      ],
    },
  ],
  ...overrides,
});

describe('ItineraryBlock', () => {
  describe('rendering', () => {
    it('should render all days', () => {
      render(<ItineraryBlock block={createMockBlock()} />);

      expect(screen.getByText('Day 1')).toBeInTheDocument();
      expect(screen.getByText('Day 2')).toBeInTheDocument();
    });

    it('should render day titles', () => {
      render(<ItineraryBlock block={createMockBlock()} />);

      expect(screen.getByText('Arrival & Orientation')).toBeInTheDocument();
      expect(screen.getByText('Sightseeing')).toBeInTheDocument();
    });

    it('should render activities', () => {
      render(<ItineraryBlock block={createMockBlock()} />);

      expect(screen.getByText('Airport arrival')).toBeInTheDocument();
      expect(screen.getByText('Eiffel Tower')).toBeInTheDocument();
      expect(screen.getByText('Louvre Museum')).toBeInTheDocument();
    });

    it('should return null for empty days', () => {
      const { container } = render(<ItineraryBlock block={createMockBlock({ days: [] })} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('activity details', () => {
    it('should render activity times', () => {
      render(<ItineraryBlock block={createMockBlock()} />);

      expect(screen.getByText('10:00')).toBeInTheDocument();
      expect(screen.getByText('09:00')).toBeInTheDocument();
    });

    it('should render activity locations', () => {
      render(<ItineraryBlock block={createMockBlock()} />);

      expect(screen.getByText('CDG Airport')).toBeInTheDocument();
      expect(screen.getByText('Hotel Le Marais')).toBeInTheDocument();
    });

    it('should render activity durations', () => {
      render(<ItineraryBlock block={createMockBlock()} />);

      expect(screen.getByText('(2 hours)')).toBeInTheDocument();
      expect(screen.getByText('(3 hours)')).toBeInTheDocument();
    });

    it('should render activity notes', () => {
      render(<ItineraryBlock block={createMockBlock()} />);

      expect(screen.getByText('Explore the neighborhood')).toBeInTheDocument();
    });
  });

  describe('day numbers', () => {
    it('should display day number in badge', () => {
      render(<ItineraryBlock block={createMockBlock()} />);

      // Day numbers should be displayed
      const dayBadges = screen.getAllByText('1');
      expect(dayBadges.length).toBeGreaterThan(0);
    });
  });

  describe('without optional fields', () => {
    it('should handle days without titles', () => {
      render(
        <ItineraryBlock
          block={createMockBlock({
            days: [
              {
                day: 1,
                activities: [{ activity: 'Explore' }],
              },
            ],
          })}
        />
      );

      expect(screen.getByText('Explore')).toBeInTheDocument();
    });

    it('should handle activities without times', () => {
      render(
        <ItineraryBlock
          block={createMockBlock({
            days: [
              {
                day: 1,
                activities: [{ activity: 'Free time' }],
              },
            ],
          })}
        />
      );

      expect(screen.getByText('Free time')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have aria-hidden on icons', () => {
      const { container } = render(<ItineraryBlock block={createMockBlock()} />);
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });
});
