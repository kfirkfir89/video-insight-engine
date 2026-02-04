import { memo } from 'react';
import { Circle } from 'lucide-react';
import { BlockWrapper } from './BlockWrapper';
import type { TimelineBlock as TimelineBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface TimelineBlockProps {
  block: TimelineBlockType;
}

/**
 * Renders a visual timeline of events.
 * Each event can have a date/time, title, and description.
 */
export const TimelineBlock = memo(function TimelineBlock({ block }: TimelineBlockProps) {
  const events = block.events ?? [];

  if (events.length === 0) return null;

  return (
    <BlockWrapper
      blockId={block.blockId}
      label={BLOCK_LABELS.timeline}
    >
      <ol className="relative border-l border-border/50 ml-2 space-y-4" aria-label={BLOCK_LABELS.timeline}>
        {events.map((event, index) => (
          <li key={index} className="ml-4">
            <div className="absolute w-3 h-3 bg-background border-2 border-primary/60 rounded-full -left-1.5 mt-1.5">
              <Circle className="w-full h-full text-primary/60" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              {(event.date || event.time) && (
                <time className="text-xs font-medium text-muted-foreground/70 tabular-nums">
                  {event.date}
                  {event.date && event.time && ' • '}
                  {event.time}
                </time>
              )}
              <h4 className="text-sm font-medium">{event.title}</h4>
              {event.description && (
                <p className="text-sm text-muted-foreground">{event.description}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </BlockWrapper>
  );
});
