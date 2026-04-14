import { memo, useState, useMemo, useEffect } from 'react';
import { Clock, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FadeIn, Badge } from '@/components/vie';

import { useTabState } from '@/features/video-output/contexts/TabStateContext';

interface TimelineEntry {
  time: string;
  seconds: number;
  label: string;
  description?: string;
  mood?: string;
  emoji?: string;
  speaker?: string;
  thumbnailUrl?: string;
}

interface TimelineExplorerProps {
  entries: TimelineEntry[];
  onSeek?: (seconds: number) => void;
  currentTime?: number;
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

export const TimelineExplorer = memo(function TimelineExplorer({
  entries,
  onSeek,
  currentTime,
  nextTab: _nextTab,
  onNavigateTab: _onNavigateTab,
}: TimelineExplorerProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [moodFilter, setMoodFilter] = useState<string | null>(null);
  const tabState = useTabState();

  // Clear expanded indices when filter changes (indices shift)
  useEffect(() => {
    setExpanded(new Set());
  }, [moodFilter]);

  // Read completedSteps from cross-tab state
  const completedStepCount = tabState.completedSteps.size;

  // Find active entry based on currentTime
  const activeEntryIndex = useMemo(() => {
    if (currentTime == null) return -1;
    let best = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].seconds <= currentTime) best = i;
      else break;
    }
    return best;
  }, [entries, currentTime]);

  const uniqueMoods = useMemo(() => {
    const moods = new Set<string>();
    for (const entry of entries) {
      if (entry.mood) moods.add(entry.mood);
    }
    return Array.from(moods);
  }, [entries]);

  const filtered = useMemo(
    () => (moodFilter ? entries.filter((e) => e.mood === moodFilter) : entries),
    [entries, moodFilter],
  );

  const toggleExpand = (index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  if (entries.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Mood filter pills */}
      {uniqueMoods.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={moodFilter === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMoodFilter(null)}
            className="text-xs rounded-full"
          >
            All
          </Button>
          {uniqueMoods.map((mood) => (
            <Button
              key={mood}
              variant={moodFilter === mood ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMoodFilter(moodFilter === mood ? null : mood)}
              className="text-xs rounded-full capitalize"
            >
              {mood}
            </Button>
          ))}
        </div>
      )}

      {/* Cross-tab step completion summary */}
      {completedStepCount > 0 && (
        <div className="flex items-center gap-2 px-1 text-xs text-success">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{completedStepCount} step{completedStepCount !== 1 ? 's' : ''} completed</span>
        </div>
      )}

      {/* Timeline */}
      <ol className="relative ms-2 space-y-3" aria-label="Timeline">
        <div
          className="absolute start-[5px] top-2 bottom-2 w-px bg-gradient-to-b from-primary/40 via-primary/20 to-transparent"
          aria-hidden="true"
        />

        {filtered.map((entry, index) => {
          const isActive = activeEntryIndex >= 0 && entries[activeEntryIndex] === entry;
          const isExpanded = expanded.has(index) || isActive;
          const hasDetail = !!entry.description;

          return (
            <FadeIn key={index} index={index}>
              <li className={cn(
                'relative ms-6 rounded-lg transition-colors',
                isActive && 'border border-[var(--vie-accent)] bg-[var(--vie-accent)]/5 p-2 ms-0 ps-8',
              )}>
                <div
                  className={cn(
                    'absolute w-3 h-3 bg-background border-2 rounded-full mt-1.5 z-10',
                    isActive ? 'border-[var(--vie-accent)] -start-[29px]' : 'border-primary -start-[29px]',
                    isActive && 'start-[3px]',
                  )}
                  aria-hidden="true"
                />

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {onSeek ? (
                      <Button
                        variant="ghost"
                        size="bare"
                        onClick={() => onSeek(entry.seconds)}
                        className="text-xs font-bold tabular-nums text-primary bg-primary/10 px-2 py-0.5 rounded-md hover:bg-primary/20"
                      >
                        <Clock className="h-3 w-3 me-1" aria-hidden="true" />
                        {entry.time}
                      </Button>
                    ) : (
                      <span className="text-xs font-bold tabular-nums text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                        {entry.time}
                      </span>
                    )}
                    {entry.emoji && <span aria-hidden="true">{entry.emoji}</span>}
                    {entry.mood && <Badge variant="muted" className="text-[10px] capitalize">{entry.mood}</Badge>}
                    {entry.speaker && (
                      <span className="text-xs text-muted-foreground/70 italic">{entry.speaker}</span>
                    )}
                  </div>

                  <div
                    className={cn('flex items-start gap-2', hasDetail && 'cursor-pointer')}
                    onClick={() => hasDetail && toggleExpand(index)}
                    role={hasDetail ? 'button' : undefined}
                    tabIndex={hasDetail ? 0 : undefined}
                    onKeyDown={(e) => hasDetail && (e.key === 'Enter' || e.key === ' ') && toggleExpand(index)}
                  >
                    {entry.thumbnailUrl && (
                      <img
                        src={entry.thumbnailUrl}
                        alt={entry.label}
                        loading="lazy"
                        className="w-16 h-10 rounded object-cover shrink-0 border border-border/30"
                      />
                    )}
                    <span className="text-sm font-medium flex-1">{entry.label}</span>
                    {hasDetail && (
                      isExpanded
                        ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                        : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </div>

                  {isExpanded && entry.description && (
                    <FadeIn>
                      <p className="text-sm text-muted-foreground ps-0.5">
                        {entry.description}
                      </p>
                    </FadeIn>
                  )}
                </div>
              </li>
            </FadeIn>
          );
        })}
      </ol>

    </div>
  );
});
