import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpotCard } from '../SpotCard';

const createSpot = (overrides = {}) => ({
  icon: '\u{1F37D}\u{FE0F}',
  name: 'Test Restaurant',
  subtitle: 'Italian cuisine',
  cost: '25',
  currency: '$',
  tip: 'Ask for the daily special',
  mapsQuery: 'Test Restaurant NYC',
  bookingSearch: 'Test Restaurant',
  ...overrides,
});

describe('SpotCard', () => {
  describe('rendering', () => {
    it('should render spot name and subtitle', () => {
      render(<SpotCard spot={createSpot()} />);

      expect(screen.getByText('Test Restaurant')).toBeInTheDocument();
      expect(screen.getByText('Italian cuisine')).toBeInTheDocument();
    });

    it('should render emoji icon', () => {
      render(<SpotCard spot={createSpot()} />);

      expect(screen.getByText('\u{1F37D}\u{FE0F}')).toBeInTheDocument();
    });

    it('should render cost badge with currency', () => {
      render(<SpotCard spot={createSpot()} />);

      expect(screen.getByText('$ 25')).toBeInTheDocument();
    });

    it('should not render cost badge when no cost', () => {
      render(<SpotCard spot={createSpot({ cost: undefined })} />);

      expect(screen.queryByText('FREE')).not.toBeInTheDocument();
      expect(screen.queryByText('$ 25')).not.toBeInTheDocument();
    });

    it('should render rating when provided', () => {
      render(<SpotCard spot={createSpot({ rating: 4.5 })} />);

      expect(screen.getByText('4.5')).toBeInTheDocument();
    });

    it('should render specs badge when provided', () => {
      render(<SpotCard spot={createSpot({ specs: '16GB RAM' })} />);

      expect(screen.getByText('16GB RAM')).toBeInTheDocument();
    });
  });

  describe('expansion', () => {
    it('should show tip text when expanded', () => {
      render(<SpotCard spot={createSpot()} />);

      // Tip should not be visible initially
      expect(screen.queryByText('Ask for the daily special')).not.toBeInTheDocument();

      // Click to expand
      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText('Ask for the daily special')).toBeInTheDocument();
    });

    it('should show Maps link when expanded', () => {
      render(<SpotCard spot={createSpot()} />);

      fireEvent.click(screen.getByRole('button'));

      const mapsLink = screen.getByText('Open in Maps');
      expect(mapsLink).toBeInTheDocument();
      expect(mapsLink.closest('a')).toHaveAttribute(
        'href',
        expect.stringContaining('google.com/maps')
      );
    });

    it('should show Booking link when expanded', () => {
      render(<SpotCard spot={createSpot()} />);

      fireEvent.click(screen.getByRole('button'));

      const bookingLink = screen.getByText('Search Booking');
      expect(bookingLink).toBeInTheDocument();
      expect(bookingLink.closest('a')).toHaveAttribute(
        'href',
        expect.stringContaining('booking.com')
      );
    });

    it('should collapse when clicked again', () => {
      render(<SpotCard spot={createSpot()} />);

      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText('Ask for the daily special')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button'));
      expect(screen.queryByText('Ask for the daily special')).not.toBeInTheDocument();
    });

    it('should not be expandable when no tip or links', () => {
      render(<SpotCard spot={createSpot({ tip: undefined, mapsQuery: undefined, bookingSearch: undefined })} />);

      const button = screen.getByRole('button');
      expect(button).not.toHaveAttribute('aria-expanded');
    });
  });

  describe('edge cases', () => {
    it('should render with minimal props', () => {
      render(<SpotCard spot={{ name: 'Minimal Spot' }} />);

      expect(screen.getByText('Minimal Spot')).toBeInTheDocument();
    });
  });
});
