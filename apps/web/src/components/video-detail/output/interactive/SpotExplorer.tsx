import { memo, useCallback, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, ExternalLink, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { SpotItem } from '@vie/types';
import { GlassCard } from '../GlassCard';
import { CrossTabLink } from '../CrossTabLink';

interface SpotSection {
  label: string;
  spotIndices: number[];
}

interface SpotExplorerProps {
  spots: SpotItem[];
  sections?: SpotSection[];
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

export const SpotExplorer = memo(function SpotExplorer({
  spots,
  sections,
  nextTab,
  onNavigateTab,
}: SpotExplorerProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [activeSection, setActiveSection] = useState(0);

  const toggleExpand = useCallback((index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  if (spots.length === 0) return null;

  const visibleIndices = sections?.[activeSection]?.spotIndices
    ?? spots.map((_, i) => i);

  return (
    <GlassCard className="space-y-4">
      {/* Section pills */}
      {sections && sections.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sections.map((section, sIndex) => (
            <button
              key={sIndex}
              type="button"
              onClick={() => setActiveSection(sIndex)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150',
                sIndex === activeSection
                  ? 'bg-[var(--vie-accent)] text-[var(--vie-accent-foreground,white)]'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/50',
              )}
            >
              {section.label}
            </button>
          ))}
        </div>
      )}

      {/* Spot list */}
      <div className="space-y-1.5">
        {visibleIndices.map((spotIndex) => {
          const spot = spots[spotIndex];
          if (!spot) return null;

          const isExpanded = expanded.has(spotIndex);
          const hasExpandable = spot.tips || spot.mapQuery || spot.bookingSearch || spot.description;

          return (
            <div
              key={spotIndex}
              className="rounded-lg border border-border/50 overflow-hidden"
            >
              {/* Header */}
              <button
                type="button"
                onClick={() => hasExpandable && toggleExpand(spotIndex)}
                className={cn(
                  'w-full text-left px-4 py-3 flex items-center gap-3 transition-all duration-150',
                  hasExpandable && 'cursor-pointer active:scale-[0.97]',
                  !hasExpandable && 'cursor-default',
                )}
                aria-expanded={hasExpandable ? isExpanded : undefined}
              >
                <span className="text-xl shrink-0" aria-hidden="true">{spot.emoji}</span>
                <span className="flex-1 min-w-0 font-medium text-sm truncate">{spot.name}</span>

                {spot.rating != null && spot.rating > 0 && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Star className="h-3.5 w-3.5 text-warning fill-warning" aria-hidden="true" />
                    <span className="text-xs font-medium tabular-nums">{spot.rating}</span>
                  </div>
                )}

                {spot.cost && (
                  <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
                    {spot.cost}
                  </span>
                )}

                {hasExpandable && (
                  <span className="shrink-0 text-muted-foreground/50" aria-hidden="true">
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </span>
                )}
              </button>

              {/* Expanded */}
              {isExpanded && hasExpandable && (
                <div className="animate-[fadeUp_0.2s_ease-out_both] px-4 pb-4 space-y-3">
                  {spot.description && (
                    <p className="text-sm text-muted-foreground">{spot.description}</p>
                  )}
                  {spot.tips && (
                    <p className="text-sm text-muted-foreground bg-muted/20 rounded-md p-3">
                      {spot.tips}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    {spot.mapQuery && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.mapQuery)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                      >
                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                        Open in Maps
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    )}
                    {spot.bookingSearch && (
                      <a
                        href={`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(spot.bookingSearch)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        Search Booking
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Cross-tab link */}
      {nextTab && onNavigateTab && (
        <CrossTabLink tabId={nextTab} label="Continue" onNavigate={onNavigateTab} />
      )}
    </GlassCard>
  );
});
