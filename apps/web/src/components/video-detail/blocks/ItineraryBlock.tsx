import { memo } from 'react';
import { Calendar, Clock, MapPin } from 'lucide-react';
import { BlockWrapper } from './BlockWrapper';
import type { ItineraryBlock as ItineraryBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface ItineraryBlockProps {
  block: ItineraryBlockType;
}

/**
 * Renders a day-by-day travel itinerary.
 */
export const ItineraryBlock = memo(function ItineraryBlock({ block }: ItineraryBlockProps) {
  const days = block.days ?? [];

  if (days.length === 0) return null;

  return (
    <BlockWrapper
      blockId={block.blockId}
      label={BLOCK_LABELS.itinerary}
      variant="card"
      headerIcon={<Calendar className="h-4 w-4" />}
      headerLabel={BLOCK_LABELS.itinerary}
    >
      <div className="space-y-4">
        <div className="space-y-6">
          {days.map((day) => (
            <div key={day.day} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-full glass-surface bg-primary/10 text-primary text-sm font-bold text-gradient-primary day-number-glow">
                  {day.day}
                </span>
                <div>
                  <span className="text-xs text-muted-foreground/70">{BLOCK_LABELS.day} {day.day}</span>
                  {day.title && <h4 className="font-medium text-sm">{day.title}</h4>}
                </div>
              </div>

              <div className="ml-4 pl-6 relative space-y-3 stagger-children">
                {/* Gradient connecting line */}
                <div className="timeline-line" aria-hidden="true" />
                {day.activities.map((activity, actIndex) => (
                  <div key={actIndex} className="relative pl-4 space-y-1">
                    {/* Activity dot */}
                    <div className="absolute left-[-4px] top-1.5 w-2 h-2 rounded-full bg-primary/40 z-10" aria-hidden="true" />
                    <div className="flex items-center gap-2 text-sm">
                      {activity.time && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground tabular-nums">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {activity.time}
                        </span>
                      )}
                      <span className="font-medium">{activity.activity}</span>
                      {activity.duration && (
                        <span className="text-xs text-muted-foreground/60">({activity.duration})</span>
                      )}
                    </div>
                    {activity.location && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" aria-hidden="true" />
                        <span>{activity.location}</span>
                      </div>
                    )}
                    {activity.notes && (
                      <p className="text-xs text-muted-foreground/70 italic">{activity.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </BlockWrapper>
  );
});
