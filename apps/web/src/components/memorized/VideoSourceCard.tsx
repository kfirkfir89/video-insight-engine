import { memo } from 'react';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface VideoSourceCardProps {
  title: string;
  youtubeId: string;
  thumbnailUrl?: string;
  channel?: string;
  duration?: string;
  className?: string;
}

/**
 * Card showing the source video for a memorized item.
 * Links to the original YouTube video.
 */
export const VideoSourceCard = memo(function VideoSourceCard({
  title,
  youtubeId,
  thumbnailUrl,
  channel,
  duration,
  className,
}: VideoSourceCardProps) {
  const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
  const effectiveThumbnail = thumbnailUrl || `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;

  return (
    <div
      className={cn(
        'flex gap-3 p-3 rounded-lg border border-border/50 bg-muted/20',
        className
      )}
    >
      {/* Thumbnail */}
      <div className="relative shrink-0 w-24 h-16 rounded overflow-hidden bg-muted">
        <img
          src={effectiveThumbnail}
          alt={title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {duration && (
          <span className="absolute bottom-0.5 right-0.5 px-1 py-0.5 text-[10px] bg-black/80 text-white rounded">
            {duration}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <h4 className="text-sm font-medium line-clamp-2 leading-tight">{title}</h4>
          {channel && (
            <p className="text-xs text-muted-foreground mt-0.5">{channel}</p>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          asChild
          className="w-fit -ml-2 gap-1 text-xs text-primary hover:text-primary"
        >
          <a href={youtubeUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            Open on YouTube
          </a>
        </Button>
      </div>
    </div>
  );
});
