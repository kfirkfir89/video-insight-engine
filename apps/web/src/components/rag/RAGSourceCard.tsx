import { memo } from 'react';
import { ExternalLink, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface RAGSourceCardProps {
  title: string;
  youtubeId: string;
  thumbnailUrl?: string;
  timestamp?: string;
  timestampSeconds?: number;
  relevanceScore?: number;
  onSeek?: (seconds: number) => void;
  className?: string;
}

/**
 * Card showing a RAG source with video reference.
 * Links to specific timestamp in the source video.
 */
export const RAGSourceCard = memo(function RAGSourceCard({
  title,
  youtubeId,
  thumbnailUrl,
  timestamp,
  timestampSeconds,
  relevanceScore,
  onSeek,
  className,
}: RAGSourceCardProps) {
  const youtubeUrl = timestampSeconds
    ? `https://www.youtube.com/watch?v=${youtubeId}&t=${timestampSeconds}s`
    : `https://www.youtube.com/watch?v=${youtubeId}`;
  const effectiveThumbnail = thumbnailUrl || `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;

  return (
    <div
      className={cn(
        'flex gap-2 p-2 rounded-md border border-border/30 bg-muted/20 text-sm',
        className
      )}
    >
      {/* Thumbnail */}
      <div className="relative shrink-0 w-16 h-10 rounded overflow-hidden bg-muted">
        <img
          src={effectiveThumbnail}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {timestamp && (
          <span className="absolute bottom-0 right-0 px-0.5 text-[9px] bg-black/80 text-white rounded-tl">
            {timestamp}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <p className="text-xs font-medium line-clamp-1 leading-tight">{title}</p>

        <div className="flex items-center gap-2">
          {onSeek && timestampSeconds !== undefined && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSeek(timestampSeconds)}
              className="h-5 px-1.5 text-[10px] gap-1 text-primary"
            >
              <Play className="h-3 w-3" aria-hidden="true" />
              Jump to
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="h-5 px-1.5 text-[10px] gap-1"
          >
            <a href={youtubeUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              Open
            </a>
          </Button>

          {relevanceScore !== undefined && (
            <span className="text-[10px] text-muted-foreground ml-auto">
              {Math.round(relevanceScore * 100)}% match
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
