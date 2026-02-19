import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemorizedGrid } from '../MemorizedGrid';
import type { MemorizedItem } from '@vie/types';

const createMockItem = (overrides: Partial<MemorizedItem> = {}): MemorizedItem => ({
  id: 'item-1',
  userId: 'user-1',
  title: 'Test Item',
  folderId: null,
  sourceType: 'video_chapters',
  source: {
    videoSummaryId: 'vs-1',
    youtubeId: 'abc123',
    videoTitle: 'Test Video',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    youtubeUrl: 'https://youtube.com/watch?v=abc123',
  },
  chapters: [],
  videoContext: {
    youtubeCategory: 'Education',
    category: 'education',
    tags: [],
    displayTags: [],
  },
  notes: null,
  tags: ['tag1', 'tag2'],
  collectionIds: [],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('MemorizedGrid', () => {
  describe('rendering', () => {
    it('should render grid of items', () => {
      const items = [
        createMockItem({ id: 'item-1', title: 'First Item' }),
        createMockItem({ id: 'item-2', title: 'Second Item' }),
      ];
      render(<MemorizedGrid items={items} />);

      expect(screen.getByText('First Item')).toBeInTheDocument();
      expect(screen.getByText('Second Item')).toBeInTheDocument();
    });

    it('should render empty state when no items', () => {
      render(<MemorizedGrid items={[]} />);

      expect(screen.getByText('No memorized items yet')).toBeInTheDocument();
      expect(
        screen.getByText(/save sections, concepts, or expansions/i)
      ).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <MemorizedGrid items={[createMockItem()]} className="custom-class" />
      );
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should apply grid classes', () => {
      const { container } = render(<MemorizedGrid items={[createMockItem()]} />);
      expect(container.firstChild).toHaveClass('grid');
    });
  });

  describe('card display', () => {
    it('should display item title', () => {
      render(<MemorizedGrid items={[createMockItem({ title: 'My Card Title' })]} />);
      expect(screen.getByText('My Card Title')).toBeInTheDocument();
    });

    it('should display thumbnail', () => {
      const { container } = render(<MemorizedGrid items={[createMockItem()]} />);
      const img = container.querySelector('img');
      expect(img).toHaveAttribute('src', 'https://example.com/thumb.jpg');
    });

    it('should use YouTube thumbnail fallback', () => {
      const { container } = render(
        <MemorizedGrid
          items={[
            createMockItem({
              source: {
                videoSummaryId: 'vs-1',
                youtubeId: 'xyz789',
                videoTitle: 'Test Video',
                thumbnailUrl: '',
                youtubeUrl: 'https://youtube.com/watch?v=xyz789',
              },
            }),
          ]}
        />
      );
      const img = container.querySelector('img');
      expect(img).toHaveAttribute(
        'src',
        'https://img.youtube.com/vi/xyz789/mqdefault.jpg'
      );
    });

    it('should display source video title if different from item title', () => {
      render(
        <MemorizedGrid
          items={[
            createMockItem({
              title: 'Item Title',
              source: {
                videoSummaryId: 'vs-1',
                youtubeId: 'abc123',
                videoTitle: 'Different Video Title',
                thumbnailUrl: 'https://example.com/thumb.jpg',
                youtubeUrl: 'https://youtube.com/watch?v=abc123',
              },
            }),
          ]}
        />
      );
      expect(screen.getByText(/from: different video title/i)).toBeInTheDocument();
    });

    it('should not display source video title if same as item title', () => {
      render(
        <MemorizedGrid
          items={[
            createMockItem({
              title: 'Same Title',
              source: {
                videoSummaryId: 'vs-1',
                youtubeId: 'abc123',
                videoTitle: 'Same Title',
                thumbnailUrl: 'https://example.com/thumb.jpg',
                youtubeUrl: 'https://youtube.com/watch?v=abc123',
              },
            }),
          ]}
        />
      );
      expect(screen.queryByText(/from:/i)).not.toBeInTheDocument();
    });

    it('should display tags (max 3)', () => {
      render(
        <MemorizedGrid
          items={[
            createMockItem({ tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'] }),
          ]}
        />
      );
      expect(screen.getByText('tag1')).toBeInTheDocument();
      expect(screen.getByText('tag2')).toBeInTheDocument();
      expect(screen.getByText('tag3')).toBeInTheDocument();
      expect(screen.getByText('+2')).toBeInTheDocument();
      expect(screen.queryByText('tag4')).not.toBeInTheDocument();
    });

    it('should not show tag overflow for 3 or fewer tags', () => {
      render(
        <MemorizedGrid items={[createMockItem({ tags: ['tag1', 'tag2', 'tag3'] })]} />
      );
      expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onItemClick when card is clicked', () => {
      const onItemClick = vi.fn();
      const item = createMockItem();
      render(<MemorizedGrid items={[item]} onItemClick={onItemClick} />);

      fireEvent.click(screen.getByRole('button'));

      expect(onItemClick).toHaveBeenCalledTimes(1);
      expect(onItemClick).toHaveBeenCalledWith(item);
    });

    it('should handle clicks without callback gracefully', () => {
      render(<MemorizedGrid items={[createMockItem()]} />);

      // Should not throw
      fireEvent.click(screen.getByRole('button'));
    });

    it('should handle multiple items correctly', () => {
      const onItemClick = vi.fn();
      const item1 = createMockItem({ id: 'item-1', title: 'First' });
      const item2 = createMockItem({ id: 'item-2', title: 'Second' });

      render(<MemorizedGrid items={[item1, item2]} onItemClick={onItemClick} />);

      fireEvent.click(screen.getByText('Second'));

      expect(onItemClick).toHaveBeenCalledWith(item2);
    });
  });

  describe('accessibility', () => {
    it('should render cards as buttons', () => {
      render(<MemorizedGrid items={[createMockItem()]} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should render as button element', () => {
      render(<MemorizedGrid items={[createMockItem()]} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should have lazy loading on images', () => {
      const { container } = render(<MemorizedGrid items={[createMockItem()]} />);
      const img = container.querySelector('img');
      expect(img).toHaveAttribute('loading', 'lazy');
    });

    it('should have play icon hidden from assistive tech', () => {
      const { container } = render(<MemorizedGrid items={[createMockItem()]} />);
      // The play icon should have aria-hidden
      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
