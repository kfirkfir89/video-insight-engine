import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { TimestampBlock } from '@vie/types';
import { Play, StopCircle } from 'lucide-react';
import { BlockWrapper } from './BlockWrapper';

interface TimestampRendererProps {
  block: TimestampBlock;
  onSeek?: (seconds: number) => void;
  /** Opens collapsed video and plays from timestamp - preferred over onSeek */
  onPlay?: (seconds: number) => void;
  /** Stop video playback */
  onStop?: () => void;
  /** Whether this specific timestamp is currently playing */
  isActive?: boolean;
}

/**
 * Renders a clickable timestamp that can seek the video player.
 * Displays: Play icon + time (monospace) + label
 * When active (video playing from this timestamp), shows Stop button instead.
 */
export const TimestampRenderer = memo(function TimestampRenderer({ block, onSeek, onPlay, onStop, isActive }: TimestampRendererProps) {
  const handleClick = () => {
    // Prefer onPlay (opens collapsed video) over onSeek (just seeks)
    if (onPlay) {
      onPlay(block.seconds);
    } else if (onSeek) {
      onSeek(block.seconds);
    }
  };

  const handleStop = () => {
    if (onStop) {
      onStop();
    }
  };

  const isClickable = onPlay || onSeek;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isActive) {
        handleStop();
      } else {
        handleClick();
      }
    }
  };

  // Active state: show stop button
  if (isActive) {
    return (
      <BlockWrapper
        blockId={block.blockId}
        variant="transparent"
        label={block.label ? `Timestamp ${block.time} - ${block.label}` : `Timestamp ${block.time}`}
      >
        <div className="pl-0.5">
          <button
            type="button"
            onClick={handleStop}
            onKeyDown={handleKeyDown}
            className="inline-flex items-center gap-1.5 text-sm cursor-pointer text-destructive hover:text-destructive/80 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label={block.label ? `Stop video at ${block.time} - ${block.label}` : `Stop video at ${block.time}`}
          >
            <StopCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="font-mono tabular-nums">
              {block.time}
            </span>
            {block.label && (
              <span className="text-muted-foreground">{block.label}</span>
            )}
          </button>
        </div>
      </BlockWrapper>
    );
  }

  // Default: show play button
  return (
    <BlockWrapper
      blockId={block.blockId}
      variant="transparent"
      label={block.label ? `Timestamp ${block.time} - ${block.label}` : `Timestamp ${block.time}`}
    >
      <div className="pl-0.5">
        <button
          type="button"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          disabled={!isClickable}
          className={cn(
            'inline-flex items-center gap-1.5 text-sm rounded-sm',
            isClickable
              ? 'cursor-pointer text-primary hover:text-primary/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
              : 'cursor-default text-muted-foreground'
          )}
          aria-label={block.label ? `Jump to ${block.time} - ${block.label}` : `Jump to ${block.time}`}
        >
          <Play className="h-3.5 w-3.5 shrink-0 fill-current" aria-hidden="true" />
          <span
            className={cn(
              'font-mono tabular-nums',
              isClickable && 'hover:underline underline-offset-2'
            )}
          >
            {block.time}
          </span>
          {block.label && (
            <span className="text-muted-foreground">{block.label}</span>
          )}
        </button>
      </div>
    </BlockWrapper>
  );
});
