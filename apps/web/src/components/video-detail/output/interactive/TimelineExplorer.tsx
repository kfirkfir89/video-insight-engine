import { memo, useState, useMemo } from 'react';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CrossTabLink } from '../CrossTabLink';

interface TimelineEntry {
  time: string;
  seconds: number;
  label: string;
  description?: string;
  mood?: string;
  emoji?: string;
}

interface TimelineExplorerProps {
  entries: TimelineEntry[];
  onSeek?: (seconds: number) => void;
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

export const TimelineExplorer = memo(function TimelineExplorer({
  entries,
  onSeek,
  nextTab,
  onNavigateTab,
}: TimelineExplorerProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [moodFilter, setMoodFilter] = useState<string | null>(null);

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

      {/* Timeline */}
      <ol className="relative ml-2 space-y-3" aria-label="Timeline">
        {/* Vertical line */}
        <div
          className="absolute left-[5px] top-2 bottom-2 w-px bg-gradient-to-b from-primary/40 via-primary/20 to-transparent"
          aria-hidden="true"
        />

        {filtered.map((entry, index) => {
          const isExpanded = expanded.has(index);
          const hasDetail = !!entry.description;

          return (
            <li key={index} className="relative ml-6">
              {/* Dot */}
              <div
                className="absolute w-3 h-3 bg-background border-2 border-primary rounded-full -left-[29px] mt-1.5 z-10"
                aria-hidden="true"
              />

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Time badge */}
                  {onSeek ? (
                    <Button
                      variant="ghost"
                      size="bare"
                      onClick={() => onSeek(entry.seconds)}
                      className="text-xs font-bold tabular-nums text-primary bg-primary/10 px-2 py-0.5 rounded-md hover:bg-primary/20"
                    >
                      <Clock className="h-3 w-3 mr-1" aria-hidden="true" />
                      {entry.time}
                    </Button>
                  ) : (
                    <span className="text-xs font-bold tabular-nums text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                      {entry.time}
                    </span>
                  )}
                  {entry.emoji && <span aria-hidden="true">{entry.emoji}</span>}
                  {entry.mood && (
                    <span className="text-xs text-muted-foreground/60 capitalize">{entry.mood}</span>
                  )}
                </div>

                {/* Label + expand toggle */}
                <div
                  className={cn('flex items-start gap-1', hasDetail && 'cursor-pointer')}
                  onClick={() => hasDetail && toggleExpand(index)}
                  role={hasDetail ? 'button' : undefined}
                  tabIndex={hasDetail ? 0 : undefined}
                  onKeyDown={(e) => hasDetail && e.key === 'Enter' && toggleExpand(index)}
                >
                  <span className="text-sm font-medium flex-1">{entry.label}</span>
                  {hasDetail && (
                    isExpanded
                      ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                      : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </div>

                {/* Expanded description */}
                {isExpanded && entry.description && (
                  <p className="text-sm text-muted-foreground pl-0.5 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                    {entry.description}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {nextTab && onNavigateTab && (
        <CrossTabLink tabId={nextTab} label="Next section" onNavigate={onNavigateTab} />
      )}
    </div>
  );
});
