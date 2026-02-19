import { memo, useMemo } from 'react';
import { Bookmark, ChevronRight, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { MemorizedItem } from '@vie/types';

interface MemorizedBlockListProps {
  items: MemorizedItem[];
  onItemClick?: (item: MemorizedItem) => void;
  onPlayVideo?: (item: MemorizedItem) => void;
  className?: string;
}

interface BlockListItemProps {
  item: MemorizedItem;
  onClick?: () => void;
  onPlay?: () => void;
}

const BlockListItem = memo(function BlockListItem({
  item,
  onClick,
  onPlay,
}: BlockListItemProps) {
  const thumbnail = item.source?.thumbnailUrl ||
    (item.source?.youtubeId ? `https://img.youtube.com/vi/${item.source.youtubeId}/default.jpg` : null);

  const category = item.videoContext?.category ?? 'standard';
  const blockCount = useMemo(() => {
    return item.chapters?.reduce((count, chapter) => count + (chapter.content?.length ?? 0), 0) ?? 0;
  }, [item.chapters]);

  return (
    <div
      className={cn(
        `category-${category}`,
        'group flex items-stretch rounded-lg border border-border/50 overflow-hidden',
        'bg-card hover:bg-muted/50 transition-colors'
      )}
    >
      {/* Thumbnail */}
      {thumbnail && (
        <Button
          variant="ghost"
          size="bare"
          onClick={onPlay}
          className="relative w-20 h-16 flex-shrink-0 bg-muted rounded-none"
          aria-label={`Play ${item.title}`}
        >
          <img
            src={thumbnail}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <Play className="h-5 w-5 text-white drop-shadow-lg" aria-hidden="true" />
            </div>
          </div>
        </Button>
      )}

      {/* Content */}
      <Button
        variant="ghost"
        size="bare"
        onClick={onClick}
        className="flex-1 gap-3 p-3 text-left min-w-0 rounded-none whitespace-normal justify-start"
      >
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">
            {item.title}
          </h3>

          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            {item.source?.videoTitle && item.source.videoTitle !== item.title && (
              <span className="truncate max-w-[180px]">
                {item.source.videoTitle}
              </span>
            )}
            {blockCount > 0 && (
              <span className="flex-shrink-0">
                {blockCount} {blockCount === 1 ? 'block' : 'blocks'}
              </span>
            )}
          </div>

          {/* Tags inline */}
          {item.tags.length > 0 && (
            <div className="flex gap-1 mt-1.5">
              {item.tags.slice(0, 2).map((tag, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 text-[10px] bg-muted rounded"
                >
                  {tag}
                </span>
              ))}
              {item.tags.length > 2 && (
                <span className="text-[10px] text-muted-foreground">
                  +{item.tags.length - 2}
                </span>
              )}
            </div>
          )}
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
      </Button>
    </div>
  );
});

/**
 * List layout for memorized items.
 * Shows compact rows with thumbnail, title, and metadata.
 * Optimized for scanning large collections.
 */
export const MemorizedBlockList = memo(function MemorizedBlockList({
  items,
  onItemClick,
  onPlayVideo,
  className,
}: MemorizedBlockListProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Bookmark className="h-12 w-12 mx-auto mb-3 opacity-30" aria-hidden="true" />
        <p>No memorized items yet</p>
        <p className="text-sm mt-1">Save sections, concepts, or expansions to build your knowledge base.</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {items.map((item) => (
        <BlockListItem
          key={item.id}
          item={item}
          onClick={() => onItemClick?.(item)}
          onPlay={() => onPlayVideo?.(item)}
        />
      ))}
    </div>
  );
});
