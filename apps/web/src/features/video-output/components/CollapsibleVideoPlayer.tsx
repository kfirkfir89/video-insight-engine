import { useEffect, useCallback } from 'react';
import { useVideoPlayer } from '@/features/video-output/contexts/VideoPlayerContext';
import { YouTubePlayer } from '@/components/videos/YouTubePlayer';
import { ChevronDown, ChevronUp, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleVideoPlayerProps {
  youtubeId: string;
  title?: string;
}

export function CollapsibleVideoPlayer({ youtubeId, title }: CollapsibleVideoPlayerProps) {
  const { isPlayerOpen, togglePlayer, closePlayer, playerRef } = useVideoPlayer();

  // Escape to collapse
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isPlayerOpen) {
      closePlayer();
    }
  }, [isPlayerOpen, closePlayer]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="overflow-hidden rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm">
      {/* Clickable header bar */}
      <button
        type="button"
        onClick={togglePlayer}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Play className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-medium">
            {title || 'Watch Video'}
          </span>
        </div>
        {isPlayerOpen ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {/* Player container — CSS-hidden when collapsed, NOT unmounted */}
      <div
        className={cn(
          'transition-[max-height,opacity] duration-300 ease-in-out',
          isPlayerOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
        )}
      >
        <div className="px-4 pb-4">
          <YouTubePlayer
            ref={playerRef}
            youtubeId={youtubeId}
            className="rounded-lg"
          />
        </div>
      </div>
    </div>
  );
}
