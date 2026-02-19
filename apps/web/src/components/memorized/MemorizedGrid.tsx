import { memo } from 'react';
import { Bookmark, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { MemorizedItem } from '@vie/types';

interface MemorizedGridProps {
  items: MemorizedItem[];
  onItemClick?: (item: MemorizedItem) => void;
  className?: string;
}

interface MemorizedCardProps {
  item: MemorizedItem;
  onClick?: () => void;
}

const MemorizedCard = memo(function MemorizedCard({
  item,
  onClick,
}: MemorizedCardProps) {
  const thumbnail = item.source?.thumbnailUrl ||
    (item.source?.youtubeId ? `https://img.youtube.com/vi/${item.source.youtubeId}/mqdefault.jpg` : null);

  return (
    <Button
      variant="ghost"
      size="bare"
      onClick={onClick}
      className="group text-left rounded-lg border border-border/50 overflow-hidden bg-card hover:bg-muted/50 w-full flex-col items-stretch whitespace-normal"
    >
      {/* Thumbnail */}
      {thumbnail && (
        <div className="relative aspect-video bg-muted">
          <img
            src={thumbnail}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <Play className="h-8 w-8 text-white drop-shadow-lg" aria-hidden="true" />
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-3 space-y-1.5">
        <h3 className="font-medium text-sm line-clamp-2 leading-tight">
          {item.title}
        </h3>

        {item.source?.videoTitle && item.source.videoTitle !== item.title && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            From: {item.source.videoTitle}
          </p>
        )}

        {/* Tags preview */}
        {item.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {item.tags.slice(0, 3).map((tag, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 text-[10px] bg-muted rounded"
              >
                {tag}
              </span>
            ))}
            {item.tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{item.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </Button>
  );
});

/**
 * Grid layout for memorized items.
 * Shows thumbnail cards with preview info.
 */
export const MemorizedGrid = memo(function MemorizedGrid({
  items,
  onItemClick,
  className,
}: MemorizedGridProps) {
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
    <div className={cn(
      'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
      className
    )}>
      {items.map((item) => (
        <MemorizedCard
          key={item.id}
          item={item}
          onClick={() => onItemClick?.(item)}
        />
      ))}
    </div>
  );
});
