import { memo, useState, useCallback } from 'react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockWrapper } from './BlockWrapper';
import type { TranscriptBlock as TranscriptBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface TranscriptBlockProps {
  block: TranscriptBlockType;
  onSeek?: (seconds: number) => void;
  onPlay?: (seconds: number) => void;
  activeSeconds?: number;
}

/**
 * Renders timestamped transcript lines.
 * Clicking a timestamp seeks/plays the video at that position.
 */
export const TranscriptBlock = memo(function TranscriptBlock({
  block,
  onSeek,
  onPlay,
  activeSeconds,
}: TranscriptBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const lines = block.lines ?? [];

  if (lines.length === 0) return null;

  const visibleLines = expanded ? lines : lines.slice(0, 5);
  const hasMore = lines.length > 5;

  const handleTimestampClick = useCallback(
    (seconds: number) => {
      if (onPlay) {
        onPlay(seconds);
      } else if (onSeek) {
        onSeek(seconds);
      }
    },
    [onPlay, onSeek]
  );

  return (
    <BlockWrapper
      blockId={block.blockId}
      label={BLOCK_LABELS.transcript}
      className="space-y-2"
    >
      <div className="text-xs font-medium text-muted-foreground/60 mb-2">
        {BLOCK_LABELS.transcript}
      </div>
      <div className="space-y-1 font-mono text-sm">
        {visibleLines.map((line, index) => {
          const isActive = activeSeconds !== undefined &&
            activeSeconds >= line.seconds &&
            (index === lines.length - 1 || activeSeconds < (lines[index + 1]?.seconds ?? Infinity));

          return (
            <div
              key={`${line.seconds}-${index}`}
              className={cn(
                'flex gap-3 py-1 px-2 -mx-2 rounded transition-colors',
                isActive && 'bg-primary/10'
              )}
            >
              <button
                type="button"
                onClick={() => handleTimestampClick(line.seconds)}
                className={cn(
                  'flex items-center gap-1 text-xs shrink-0 group',
                  'text-muted-foreground hover:text-primary transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded'
                )}
                aria-label={`${BLOCK_LABELS.jumpTo} ${line.time}`}
              >
                <Play className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                <span className="tabular-nums">{line.time}</span>
              </button>
              <span className="text-muted-foreground">{line.text}</span>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded px-1"
        >
          {expanded ? BLOCK_LABELS.showLess : `${BLOCK_LABELS.showMore} (${lines.length - 5} more)`}
        </button>
      )}
    </BlockWrapper>
  );
});
