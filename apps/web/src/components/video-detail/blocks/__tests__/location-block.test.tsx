import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LocationBlock } from '../LocationBlock';
import type { LocationBlock as LocationBlockType } from '@vie/types';

const createMockBlock = (overrides: Partial<LocationBlockType> = {}): LocationBlockType => ({
  type: 'location',
  blockId: 'block-1',
  name: 'Eiffel Tower',
  ...overrides,
});

describe('LocationBlock', () => {
  describe('rendering', () => {
    it('should render location name', () => {
      render(<LocationBlock block={createMockBlock()} />);

      expect(screen.getByText('Eiffel Tower')).toBeInTheDocument();
    });

    it('should render address when present', () => {
      render(
        <LocationBlock
          block={createMockBlock({ address: 'Champ de Mars, 5 Av. Anatole France, Paris' })}
        />
      );

      expect(screen.getByText('Champ de Mars, 5 Av. Anatole France, Paris')).toBeInTheDocument();
    });

    it('should render description when present', () => {
      render(
        <LocationBlock
          block={createMockBlock({ description: 'Iconic iron lattice tower on the Champ de Mars.' })}
        />
      );

      expect(screen.getByText('Iconic iron lattice tower on the Champ de Mars.')).toBeInTheDocument();
    });

    it('should return null when name is empty', () => {
      const { container } = render(<LocationBlock block={createMockBlock({ name: '' })} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('image', () => {
    it('should render image when imageUrl present', () => {
      const { container } = render(
        <LocationBlock
          block={createMockBlock({ imageUrl: 'https://example.com/eiffel.jpg' })}
        />
      );

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('src', 'https://example.com/eiffel.jpg');
      expect(img).toHaveAttribute('alt', 'Eiffel Tower');
    });

    it('should have lazy loading on image', () => {
      const { container } = render(
        <LocationBlock
          block={createMockBlock({ imageUrl: 'https://example.com/eiffel.jpg' })}
        />
      );

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('loading', 'lazy');
    });

    it('should not render image when imageUrl not present', () => {
      const { container } = render(<LocationBlock block={createMockBlock()} />);

      expect(container.querySelector('img')).toBeNull();
    });
  });

  describe('map link', () => {
    it('should render "View on Map" link when mapUrl provided', () => {
      render(
        <LocationBlock
          block={createMockBlock({ mapUrl: 'https://maps.google.com/?q=eiffel+tower' })}
        />
      );

      const link = screen.getByRole('link', { name: /view on map/i });
      expect(link).toHaveAttribute('href', 'https://maps.google.com/?q=eiffel+tower');
    });

    it('should generate map link from coordinates', () => {
      render(
        <LocationBlock
          block={createMockBlock({ coordinates: { lat: 48.8584, lng: 2.2945 } })}
        />
      );

      const link = screen.getByRole('link', { name: /view on map/i });
      expect(link).toHaveAttribute('href', 'https://www.google.com/maps?q=48.8584,2.2945');
    });

    it('should generate map link from address when no coordinates', () => {
      render(
        <LocationBlock
          block={createMockBlock({ address: 'Eiffel Tower, Paris' })}
        />
      );

      const link = screen.getByRole('link', { name: /view on map/i });
      expect(link).toHaveAttribute('href', expect.stringContaining('Eiffel%20Tower'));
    });

    it('should prefer mapUrl over generated URL', () => {
      render(
        <LocationBlock
          block={createMockBlock({
            mapUrl: 'https://custom-map-url.com',
            coordinates: { lat: 48.8584, lng: 2.2945 },
          })}
        />
      );

      const link = screen.getByRole('link', { name: /view on map/i });
      expect(link).toHaveAttribute('href', 'https://custom-map-url.com');
    });

    it('should open map link in new tab', () => {
      render(
        <LocationBlock
          block={createMockBlock({ mapUrl: 'https://maps.google.com' })}
        />
      );

      const link = screen.getByRole('link', { name: /view on map/i });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('accessibility', () => {
    it('should have aria-hidden on icons', () => {
      const { container } = render(<LocationBlock block={createMockBlock()} />);
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });
});
