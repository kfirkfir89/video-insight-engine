import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Play, StopCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BlockWrapper } from './BlockWrapper';
import type { TimelineBlock as TimelineBlockType, TimestampBlock } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

const DATE_BADGE_COLORS = ['bg-primary/10 text-primary', 'bg-info/10 text-info', 'bg-destructive/10 text-destructive'] as const;

interface TimelineEntryProps {
  block: TimelineBlockType | TimestampBlock;
  onSeek?: (seconds: number) => void;
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isActive?: boolean;
}

/**
 * Unified timeline/timestamp entry.
 * Renders either a visual timeline of events or a single clickable timestamp.
 */
export const TimelineEntry = memo(function TimelineEntry({ block, onSeek, onPlay, onStop, isActive }: TimelineEntryProps) {
  if (block.type === 'timestamp') {
    return <TimestampEntry block={block} onSeek={onSeek} onPlay={onPlay} onStop={onStop} isActive={isActive} />;
  }
  return <TimelineList block={block} />;
});

// ── Timeline List ──

function TimelineList({ block }: { block: TimelineBlockType }) {
  const events = block.events ?? [];
  if (events.length === 0) return null;

  return (
    <BlockWrapper blockId={block.blockId} variant="transparent" label={BLOCK_LABELS.timeline}>
      <ol className="relative ml-2 space-y-4 stagger-children" aria-label={BLOCK_LABELS.timeline}>
        <div className="timeline-line timeline-line-animated ml-[5px]" aria-hidden="true" />
        {events.map((event, index) => {
          const badgeColor = DATE_BADGE_COLORS[index % DATE_BADGE_COLORS.length];
          return (
            <li key={index} className="relative ml-6">
              <div className="absolute w-3 h-3 bg-background border-2 border-primary rounded-full -left-[29px] mt-1.5 z-10 timeline-dot" aria-hidden="true" />
              <div className="space-y-1">
                {(event.date || event.time) && (
                  <time className={`inline-block text-xs font-bold px-2 py-0.5 rounded-md tabular-nums ${badgeColor}`}>
                    {event.date}{event.date && event.time && ' • '}{event.time}
                  </time>
                )}
                <h4 className="text-sm font-medium">{event.title}</h4>
                {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </BlockWrapper>
  );
}

// ── Single Timestamp Entry ──

function TimestampEntry({
  block,
  onSeek,
  onPlay,
  onStop,
  isActive,
}: {
  block: TimestampBlock;
  onSeek?: (seconds: number) => void;
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isActive?: boolean;
}) {
  const handleClick = () => {
    if (onPlay) onPlay(block.seconds);
    else if (onSeek) onSeek(block.seconds);
  };

  const isClickable = onPlay || onSeek;
  const label = block.label
    ? `Timestamp ${block.time} - ${block.label}`
    : `Timestamp ${block.time}`;

  return (
    <BlockWrapper blockId={block.blockId} variant="transparent" label={label}>
      <div className="pl-0.5">
        <Button
          variant="ghost"
          size="bare"
          onClick={isActive ? onStop : handleClick}
          disabled={!isActive && !isClickable}
          className={cn(
            'text-sm',
            isActive
              ? 'cursor-pointer text-destructive hover:text-destructive/90'
              : isClickable
                ? 'cursor-pointer text-primary hover:text-primary/90'
                : 'cursor-default text-muted-foreground',
          )}
          aria-label={isActive ? `Stop video at ${block.time}` : `Jump to ${block.time}`}
        >
          {isActive ? (
            <StopCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <Play className="h-3.5 w-3.5 shrink-0 fill-current" aria-hidden="true" />
          )}
          <span className={cn('font-mono tabular-nums', isClickable && !isActive && 'hover:underline underline-offset-2')}>
            {block.time}
          </span>
          {block.label && <span className="text-muted-foreground">{block.label}</span>}
        </Button>
      </div>
    </BlockWrapper>
  );
}
