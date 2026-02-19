import { memo, useState, useCallback } from 'react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
      variant="card"
      headerIcon={<Play className="h-4 w-4" />}
      headerLabel={BLOCK_LABELS.transcript}
      className="space-y-2"
    >
      <div className="space-y-0 text-sm stagger-children">
        {visibleLines.map((line, index) => {
          const isActive = activeSeconds !== undefined &&
            activeSeconds >= line.seconds &&
            (index === lines.length - 1 || activeSeconds < (lines[index + 1]?.seconds ?? Infinity));

          // Generate a speaker color from the speaker name if present
          const speaker = (line as { speaker?: string }).speaker;

          return (
            <div key={`${line.seconds}-${index}`}>
              <div
                className={cn(
                  'flex gap-3 py-1.5 px-2 -mx-2 rounded transition-colors',
                  isActive && 'bg-info-soft dark:shadow-[inset_0_0_12px_oklch(62%_0.14_245/0.08)]'
                )}
              >
                {/* Speaker avatar */}
                {speaker && (
                  <div className="shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary" aria-hidden="true">
                    {speaker.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {speaker && (
                      <span className="text-xs font-semibold">{speaker}</span>
                    )}
                    <Button
                      variant="ghost"
                      size="bare"
                      onClick={() => handleTimestampClick(line.seconds)}
                      className="text-xs shrink-0 group font-mono text-muted-foreground hover:text-primary transition-colors"
                      aria-label={`${BLOCK_LABELS.jumpTo} ${line.time}`}
                    >
                      <Play className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                      <span className="tabular-nums">{line.time}</span>
                    </Button>
                  </div>
                  <span className="text-muted-foreground">{line.text}</span>
                </div>
              </div>
              {index < visibleLines.length - 1 && (
                <div className="fade-divider ml-8" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>

      {hasMore && (
        <Button
          variant="ghost"
          size="bare"
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-primary hover:underline px-1"
        >
          {expanded ? BLOCK_LABELS.showLess : `${BLOCK_LABELS.showMore} (${lines.length - 5} more)`}
        </Button>
      )}
    </BlockWrapper>
  );
});
