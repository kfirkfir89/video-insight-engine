import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemorizedBlockList } from '../MemorizedBlockList';
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
  chapters: [
    {
      id: 'ch-1',
      timestamp: '0:00',
      startSeconds: 0,
      endSeconds: 60,
      title: 'Chapter 1',
      content: [
        { blockId: 'b1', type: 'paragraph', text: 'Test content' },
        { blockId: 'b2', type: 'bullets', items: ['Item 1', 'Item 2'] },
      ],
    },
  ],
  videoContext: {
    youtubeCategory: 'Education',
    category: 'education',
    tags: ['test', 'example'],
    displayTags: ['Test', 'Example'],
  },
  notes: null,
  tags: ['tag1', 'tag2', 'tag3'],
  collectionIds: [],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('MemorizedBlockList', () => {
  describe('rendering', () => {
    it('should render list of items', () => {
      const items = [createMockItem(), createMockItem({ id: 'item-2', title: 'Second Item' })];
      render(<MemorizedBlockList items={items} />);

      expect(screen.getByText('Test Item')).toBeInTheDocument();
      expect(screen.getByText('Second Item')).toBeInTheDocument();
    });

    it('should render empty state when no items', () => {
      render(<MemorizedBlockList items={[]} />);

      expect(screen.getByText('No memorized items yet')).toBeInTheDocument();
      expect(screen.getByText(/save sections, concepts/i)).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <MemorizedBlockList items={[createMockItem()]} className="custom-class" />
      );
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('item display', () => {
    it('should display item title', () => {
      render(<MemorizedBlockList items={[createMockItem({ title: 'My Item Title' })]} />);
      expect(screen.getByText('My Item Title')).toBeInTheDocument();
    });

    it('should display source video title', () => {
      render(<MemorizedBlockList items={[createMockItem()]} />);
      expect(screen.getByText('Test Video')).toBeInTheDocument();
    });

    it('should display thumbnail image', () => {
      const { container } = render(<MemorizedBlockList items={[createMockItem()]} />);
      const img = container.querySelector('img');
      expect(img).toHaveAttribute('src', 'https://example.com/thumb.jpg');
    });

    it('should use YouTube thumbnail fallback when thumbnailUrl is missing', () => {
      const { container } = render(
        <MemorizedBlockList
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
      expect(img).toHaveAttribute('src', 'https://img.youtube.com/vi/xyz789/default.jpg');
    });

    it('should display block count', () => {
      render(<MemorizedBlockList items={[createMockItem()]} />);
      expect(screen.getByText('2 blocks')).toBeInTheDocument();
    });

    it('should display singular "block" for 1 block', () => {
      render(
        <MemorizedBlockList
          items={[
            createMockItem({
              chapters: [
                {
                  id: 'ch-1',
                  timestamp: '0:00',
                  startSeconds: 0,
                  endSeconds: 60,
                  title: 'Chapter',
                  isCreatorChapter: false,
                  content: [{ blockId: 'b1', type: 'paragraph', text: 'Single' }],
                },
              ],
            }),
          ]}
        />
      );
      expect(screen.getByText('1 block')).toBeInTheDocument();
    });

    it('should display tags (max 2)', () => {
      render(
        <MemorizedBlockList
          items={[createMockItem({ tags: ['tag1', 'tag2', 'tag3', 'tag4'] })]}
        />
      );
      expect(screen.getByText('tag1')).toBeInTheDocument();
      expect(screen.getByText('tag2')).toBeInTheDocument();
      expect(screen.getByText('+2')).toBeInTheDocument();
      expect(screen.queryByText('tag3')).not.toBeInTheDocument();
    });

    it('should not show tag overflow for 2 or fewer tags', () => {
      render(<MemorizedBlockList items={[createMockItem({ tags: ['tag1', 'tag2'] })]} />);
      expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
    });

    it('should not show video title if same as item title', () => {
      render(
        <MemorizedBlockList
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
      // Title should appear once (not twice)
      const titles = screen.getAllByText('Same Title');
      expect(titles).toHaveLength(1);
    });
  });

  describe('interactions', () => {
    it('should call onItemClick when item content is clicked', () => {
      const onItemClick = vi.fn();
      const item = createMockItem();
      render(<MemorizedBlockList items={[item]} onItemClick={onItemClick} />);

      // Click on the item title/content area (not thumbnail)
      fireEvent.click(screen.getByText('Test Item'));

      expect(onItemClick).toHaveBeenCalledTimes(1);
      expect(onItemClick).toHaveBeenCalledWith(item);
    });

    it('should call onPlayVideo when thumbnail is clicked', () => {
      const onPlayVideo = vi.fn();
      const item = createMockItem();
      render(<MemorizedBlockList items={[item]} onPlayVideo={onPlayVideo} />);

      // Click on the play button (thumbnail area)
      const playButton = screen.getByRole('button', { name: /play test item/i });
      fireEvent.click(playButton);

      expect(onPlayVideo).toHaveBeenCalledTimes(1);
      expect(onPlayVideo).toHaveBeenCalledWith(item);
    });

    it('should handle clicks without callbacks gracefully', () => {
      render(<MemorizedBlockList items={[createMockItem()]} />);

      // Should not throw
      fireEvent.click(screen.getByText('Test Item'));
      fireEvent.click(screen.getByRole('button', { name: /play/i }));
    });
  });

  describe('category theming', () => {
    it('should apply category class', () => {
      render(
        <MemorizedBlockList
          items={[
            createMockItem({
              videoContext: {
                youtubeCategory: 'Education',
                category: 'education',
                tags: [],
                displayTags: [],
              },
            }),
          ]}
        />
      );

      // The item wrapper should have category class
      const itemContainer = screen.getByText('Test Item').closest('.category-education');
      expect(itemContainer).toBeInTheDocument();
    });

    it('should default to standard category', () => {
      render(
        <MemorizedBlockList
          items={[
            createMockItem({
              videoContext: null,
            }),
          ]}
        />
      );

      const itemContainer = screen.getByText('Test Item').closest('.category-standard');
      expect(itemContainer).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have accessible button labels', () => {
      render(<MemorizedBlockList items={[createMockItem()]} />);

      expect(screen.getByRole('button', { name: /play test item/i })).toBeInTheDocument();
    });

    it('should be keyboard navigable', () => {
      const onItemClick = vi.fn();
      render(<MemorizedBlockList items={[createMockItem()]} onItemClick={onItemClick} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).not.toHaveAttribute('disabled');
      });
    });

    it('should have loading lazy attribute on images', () => {
      const { container } = render(<MemorizedBlockList items={[createMockItem()]} />);
      const img = container.querySelector('img');
      expect(img).toHaveAttribute('loading', 'lazy');
    });
  });
});
