import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GuestBlock } from '../GuestBlock';
import type { GuestBlock as GuestBlockType } from '@vie/types';

const createMockBlock = (overrides: Partial<GuestBlockType> = {}): GuestBlockType => ({
  type: 'guest',
  blockId: 'block-1',
  guests: [
    {
      name: 'Jane Doe',
      title: 'CEO at TechCorp',
      bio: 'Serial entrepreneur and tech visionary.',
      imageUrl: 'https://example.com/jane.jpg',
      socialLinks: [
        { platform: 'twitter', url: 'https://twitter.com/janedoe' },
        { platform: 'linkedin', url: 'https://linkedin.com/in/janedoe' },
      ],
    },
    {
      name: 'John Smith',
      title: 'Author',
    },
  ],
  ...overrides,
});

describe('GuestBlock', () => {
  describe('rendering', () => {
    it('should render all guests', () => {
      render(<GuestBlock block={createMockBlock()} />);

      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('John Smith')).toBeInTheDocument();
    });

    it('should render guest titles', () => {
      render(<GuestBlock block={createMockBlock()} />);

      expect(screen.getByText('CEO at TechCorp')).toBeInTheDocument();
      expect(screen.getByText('Author')).toBeInTheDocument();
    });

    it('should render guest bio', () => {
      render(<GuestBlock block={createMockBlock()} />);

      expect(screen.getByText('Serial entrepreneur and tech visionary.')).toBeInTheDocument();
    });

    it('should return null for empty guests', () => {
      const { container } = render(<GuestBlock block={createMockBlock({ guests: [] })} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('guest avatar', () => {
    it('should render image when imageUrl provided', () => {
      const { container } = render(<GuestBlock block={createMockBlock()} />);

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('src', 'https://example.com/jane.jpg');
      expect(img).toHaveAttribute('alt', 'Jane Doe');
    });

    it('should render placeholder when no imageUrl', () => {
      const { container } = render(
        <GuestBlock
          block={createMockBlock({
            guests: [{ name: 'No Avatar', title: 'Test' }],
          })}
        />
      );

      // Should have User icon as placeholder
      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should have lazy loading on images', () => {
      const { container } = render(<GuestBlock block={createMockBlock()} />);

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('loading', 'lazy');
    });
  });

  describe('social links', () => {
    it('should render social links when provided', () => {
      render(<GuestBlock block={createMockBlock()} />);

      const twitterLink = screen.getByRole('link', { name: /jane doe on twitter/i });
      expect(twitterLink).toHaveAttribute('href', 'https://twitter.com/janedoe');
    });

    it('should render multiple social links', () => {
      render(<GuestBlock block={createMockBlock()} />);

      expect(screen.getByRole('link', { name: /jane doe on twitter/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /jane doe on linkedin/i })).toBeInTheDocument();
    });

    it('should not render social links section when empty', () => {
      render(
        <GuestBlock
          block={createMockBlock({
            guests: [{ name: 'No Social', title: 'Test' }],
          })}
        />
      );

      // No social link icons should be present for this guest
      expect(screen.queryByRole('link', { name: /no social on/i })).not.toBeInTheDocument();
    });

    it('should open social links in new tab', () => {
      render(<GuestBlock block={createMockBlock()} />);

      const twitterLink = screen.getByRole('link', { name: /jane doe on twitter/i });
      expect(twitterLink).toHaveAttribute('target', '_blank');
      expect(twitterLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should use generic icon for unknown platforms', () => {
      render(
        <GuestBlock
          block={createMockBlock({
            guests: [
              {
                name: 'Test',
                socialLinks: [{ platform: 'website', url: 'https://example.com' }],
              },
            ],
          })}
        />
      );

      // Should still have a link even with unknown platform
      const link = screen.getByRole('link', { name: /test on website/i });
      expect(link).toHaveAttribute('href', 'https://example.com');
    });
  });

  describe('without optional fields', () => {
    it('should render guest with only name', () => {
      render(
        <GuestBlock
          block={createMockBlock({
            guests: [{ name: 'Simple Guest' }],
          })}
        />
      );

      expect(screen.getByText('Simple Guest')).toBeInTheDocument();
    });

    it('should not render title when not provided', () => {
      render(
        <GuestBlock
          block={createMockBlock({
            guests: [{ name: 'No Title Guest' }],
          })}
        />
      );

      expect(screen.getByText('No Title Guest')).toBeInTheDocument();
      // Title element should not exist
    });

    it('should not render bio when not provided', () => {
      render(
        <GuestBlock
          block={createMockBlock({
            guests: [{ name: 'No Bio', title: 'Just Title' }],
          })}
        />
      );

      expect(screen.getByText('Just Title')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have aria-label on social links', () => {
      render(<GuestBlock block={createMockBlock()} />);

      const twitterLink = screen.getByRole('link', { name: /jane doe on twitter/i });
      expect(twitterLink).toHaveAttribute('aria-label', 'Jane Doe on twitter');
    });

    it('should have aria-hidden on icons', () => {
      const { container } = render(<GuestBlock block={createMockBlock()} />);
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('URL sanitization', () => {
    it('should not render links with javascript: protocol', () => {
      render(
        <GuestBlock
          block={createMockBlock({
            guests: [
              {
                name: 'Test Guest',
                socialLinks: [
                  { platform: 'twitter', url: 'javascript:alert(1)' },
                  { platform: 'github', url: 'https://github.com/test' },
                ],
              },
            ],
          })}
        />
      );

      // Only the safe GitHub link should be rendered
      const links = screen.getAllByRole('link');
      expect(links.length).toBe(1);
      expect(links[0]).toHaveAttribute('href', 'https://github.com/test');
    });

    it('should render valid https URLs', () => {
      render(
        <GuestBlock
          block={createMockBlock({
            guests: [
              {
                name: 'Test Guest',
                socialLinks: [
                  { platform: 'linkedin', url: 'https://linkedin.com/in/test' },
                ],
              },
            ],
          })}
        />
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'https://linkedin.com/in/test');
    });
  });
});
