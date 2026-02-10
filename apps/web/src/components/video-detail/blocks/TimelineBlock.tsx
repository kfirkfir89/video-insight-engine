import { memo } from 'react';
import { BlockWrapper } from './BlockWrapper';
import type { TimelineBlock as TimelineBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

const DATE_BADGE_COLORS = ['bg-primary/10 text-primary', 'bg-info/10 text-info', 'bg-destructive/10 text-destructive'] as const;

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
      variant="transparent"
      label={BLOCK_LABELS.timeline}
    >
      <ol className="relative ml-2 space-y-4 stagger-children" aria-label={BLOCK_LABELS.timeline}>
        {/* Gradient timeline line */}
        <div className="timeline-line timeline-line-animated ml-[5px]" aria-hidden="true" />

        {events.map((event, index) => {
          const badgeColor = DATE_BADGE_COLORS[index % DATE_BADGE_COLORS.length];
          return (
            <li key={index} className="relative ml-6">
              {/* Timeline dot */}
              <div className="absolute w-3 h-3 bg-background border-2 border-primary rounded-full -left-[29px] mt-1.5 z-10 timeline-dot" aria-hidden="true" />
              <div className="space-y-1">
                {(event.date || event.time) && (
                  <time className={`inline-block text-xs font-bold px-2 py-0.5 rounded-md tabular-nums ${badgeColor}`}>
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
          );
        })}
      </ol>
    </BlockWrapper>
  );
});
