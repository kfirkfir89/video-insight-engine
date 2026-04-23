import { useEffect, useCallback } from 'react';
import { useVideoPlayer } from '@/features/video-output/contexts/VideoPlayerContext';
import { YouTubePlayer } from '@/components/videos/YouTubePlayer';
import { ChevronDown, ChevronUp, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleVideoPlayerProps {
  youtubeId: string;
  title?: string;
  /** Per-instance Video Router id — opts the title into a View Transition morph
   *  with the originating board card. Optional; omit for non-board entry points. */
  videoId?: string;
  /** When true, this wrapper participates in the "Crystallization" morph from
   *  AddVideoInput on submit. Should only be true while the video is actively
   *  streaming so the morph fires on the first paint of a fresh navigation. */
  streamSpine?: boolean;
}

export function CollapsibleVideoPlayer({ youtubeId, title, videoId, streamSpine }: CollapsibleVideoPlayerProps) {
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
    <div
      className="overflow-hidden rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm"
      style={streamSpine ? ({ viewTransitionName: 'vie-input-spine' } as React.CSSProperties) : undefined}
    >
      {/* Clickable header bar */}
      <button
        type="button"
        onClick={togglePlayer}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/30"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Play className="h-4 w-4 shrink-0 text-primary" />
          <span
            className="truncate text-sm font-medium"
            style={
              videoId
                ? ({ viewTransitionName: `vie-video-title-${videoId}` } as React.CSSProperties)
                : undefined
            }
          >
            {title || 'Watch Video'}
          </span>
        </div>
        {isPlayerOpen ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {/* Player container — CSS-hidden when collapsed, NOT unmounted.
          Animate grid-template-rows (0fr → 1fr) instead of max-height so
          the transition is composited on GPU and self-sizes to content. */}
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-300 ease-in-out',
          isPlayerOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4">
            <YouTubePlayer
              ref={playerRef}
              youtubeId={youtubeId}
              className="rounded-lg"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
