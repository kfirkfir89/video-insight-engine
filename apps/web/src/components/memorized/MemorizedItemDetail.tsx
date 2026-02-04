import { memo, useMemo } from 'react';
import { Bookmark, Clock, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ContentBlocks } from '@/components/video-detail/ContentBlocks';
import { VideoSourceCard } from './VideoSourceCard';
import { UserNotesCard } from './UserNotesCard';
import type { MemorizedItem } from '@vie/types';

interface MemorizedItemDetailProps {
  item: MemorizedItem;
  onUpdateNotes?: (notes: string) => void;
  onPlay?: (seconds: number) => void;
  className?: string;
}

/**
 * Full detail view for a memorized item.
 * Shows source video, notes, and content blocks.
 */
export const MemorizedItemDetail = memo(function MemorizedItemDetail({
  item,
  onUpdateNotes,
  onPlay,
  className,
}: MemorizedItemDetailProps) {
  const category = item.videoContext?.category ?? 'standard';

  // Get blocks from chapters
  const blocks = useMemo(() => {
    return item.chapters?.flatMap(chapter => chapter.content ?? []) ?? [];
  }, [item.chapters]);

  return (
    <div className={cn(`category-${category}`, 'space-y-4', className)}>
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Memorized Item</span>
        </div>
        <h2 className="text-lg font-semibold">{item.title}</h2>
        {item.videoContext?.displayTags && item.videoContext.displayTags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            {item.videoContext.displayTags.map((tag, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-xs bg-muted rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Source Video Card */}
      {item.source && (
        <VideoSourceCard
          title={item.source.videoTitle}
          youtubeId={item.source.youtubeId}
          thumbnailUrl={item.source.thumbnailUrl}
        />
      )}

      {/* User Notes */}
      <UserNotesCard
        notes={item.notes ?? ''}
        onSave={onUpdateNotes}
      />

      {/* Concept (if this is a memorized concept) */}
      {item.concept && (
        <div className="p-3 rounded-lg border border-primary/30 bg-primary/5">
          <h3 className="font-medium text-sm">{item.concept.name}</h3>
          {item.concept.definition && (
            <p className="text-sm text-muted-foreground mt-1">
              {item.concept.definition}
            </p>
          )}
        </div>
      )}

      {/* Expansion (if this is a memorized expansion) */}
      {item.expansion && (
        <div className="p-3 rounded-lg border border-border/50 bg-muted/30">
          <p className="text-sm leading-relaxed">{item.expansion.content}</p>
        </div>
      )}

      {/* Content Blocks */}
      {blocks.length > 0 && (
        <div className="pt-2">
          <ContentBlocks
            blocks={blocks}
            onPlay={onPlay}
          />
        </div>
      )}

      {/* Metadata footer */}
      <div className="pt-4 border-t border-border/50 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" aria-hidden="true" />
          Saved {new Date(item.createdAt).toLocaleDateString()}
        </span>
        {item.tags.length > 0 && (
          <span>{item.tags.length} tags</span>
        )}
      </div>
    </div>
  );
});
