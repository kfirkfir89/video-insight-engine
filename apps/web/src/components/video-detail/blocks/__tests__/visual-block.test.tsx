import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VisualBlock } from '../VisualBlock';
import type { VisualBlock as VisualBlockType } from '@vie/types';

const createMockBlock = (
  overrides: Partial<VisualBlockType> = {}
): VisualBlockType => ({
  type: 'visual',
  blockId: 'block-vis-1',
  description: 'Architecture diagram showing microservices communication.',
  ...overrides,
});

describe('VisualBlock', () => {
  describe('rendering', () => {
    it('should render description', () => {
      render(<VisualBlock block={createMockBlock()} />);

      expect(
        screen.getByText(
          'Architecture diagram showing microservices communication.'
        )
      ).toBeInTheDocument();
    });

    it('should render with default screenshot variant', () => {
      const { container } = render(
        <VisualBlock block={createMockBlock()} />
      );

      // Should have header label "Screenshot"
      expect(screen.getByText('Screenshot')).toBeInTheDocument();
    });

    it('should render with diagram variant', () => {
      render(
        <VisualBlock
          block={createMockBlock({ variant: 'diagram' })}
        />
      );

      expect(screen.getByText('Diagram')).toBeInTheDocument();
    });

    it('should render with whiteboard variant', () => {
      render(
        <VisualBlock
          block={createMockBlock({ variant: 'whiteboard' })}
        />
      );

      expect(screen.getByText('Whiteboard')).toBeInTheDocument();
    });

    it('should render with demo variant', () => {
      render(
        <VisualBlock
          block={createMockBlock({ variant: 'demo' })}
        />
      );

      expect(screen.getByText('Demo')).toBeInTheDocument();
    });

    it('should render custom label when provided', () => {
      render(
        <VisualBlock
          block={createMockBlock({ label: 'System Flow Diagram' })}
        />
      );

      expect(screen.getByText('System Flow Diagram')).toBeInTheDocument();
    });
  });

  describe('image rendering', () => {
    it('should render image when imageUrl is provided', () => {
      render(
        <VisualBlock
          block={createMockBlock({
            imageUrl: 'https://i.ytimg.com/vi/abc123/maxresdefault.jpg',
            label: 'Architecture',
          })}
        />
      );

      const img = screen.getByRole('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://i.ytimg.com/vi/abc123/maxresdefault.jpg');
      expect(img).toHaveAttribute('alt', 'Architecture');
    });

    it('should use description as alt text when no label', () => {
      render(
        <VisualBlock
          block={createMockBlock({
            imageUrl: 'https://i.ytimg.com/vi/abc123/maxresdefault.jpg',
          })}
        />
      );

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute(
        'alt',
        'Architecture diagram showing microservices communication.'
      );
    });

    it('should not render image when imageUrl is not provided', () => {
      render(<VisualBlock block={createMockBlock()} />);

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });

  describe('timestamp interaction', () => {
    it('should render seek button when timestamp and onSeek provided', () => {
      const onSeek = vi.fn();
      render(
        <VisualBlock
          block={createMockBlock({ timestamp: 125 })}
          onSeek={onSeek}
        />
      );

      expect(screen.getByText('View in video')).toBeInTheDocument();
    });

    it('should call onSeek with timestamp when clicked', () => {
      const onSeek = vi.fn();
      render(
        <VisualBlock
          block={createMockBlock({ timestamp: 125 })}
          onSeek={onSeek}
        />
      );

      fireEvent.click(screen.getByText('View in video'));
      expect(onSeek).toHaveBeenCalledWith(125);
    });

    it('should not render seek button without onSeek', () => {
      render(
        <VisualBlock block={createMockBlock({ timestamp: 125 })} />
      );

      expect(screen.queryByText('View in video')).not.toBeInTheDocument();
    });

    it('should not render seek button without timestamp', () => {
      const onSeek = vi.fn();
      render(<VisualBlock block={createMockBlock()} onSeek={onSeek} />);

      expect(screen.queryByText('View in video')).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should return null when description is empty', () => {
      const { container } = render(
        <VisualBlock block={createMockBlock({ description: '' })} />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('accessibility', () => {
    it('should have aria-hidden on icons', () => {
      const { container } = render(
        <VisualBlock block={createMockBlock()} />
      );
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should have aria-label on wrapper', () => {
      const { container } = render(
        <VisualBlock block={createMockBlock()} />
      );
      const section = container.querySelector('[aria-label*="Visual"]');
      expect(section).toBeInTheDocument();
    });

    it('should have lazy loading on images', () => {
      render(
        <VisualBlock
          block={createMockBlock({
            imageUrl: 'https://i.ytimg.com/vi/abc123/maxresdefault.jpg',
          })}
        />
      );

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('loading', 'lazy');
    });
  });
});
