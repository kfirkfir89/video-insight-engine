import { memo, useCallback, useState } from 'react';
import { ChevronDown, ChevronUp, Star, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SpotItem } from '@vie/types';
import { GlassCard, FadeIn, SectionNav, Badge, MapLink } from '@/components/vie';


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

/** Normalize spot data — backend may send `title`/`detail` (KeyPoint shape) instead of `name`/`description`. */
function normalizeSpot(raw: SpotItem): SpotItem {
  const r = raw as SpotItem & { title?: string; detail?: string };
  if (!r.name && r.title) {
    return { ...r, name: r.title, description: r.description || r.detail || '' };
  }
  return r;
}

export const SpotExplorer = memo(function SpotExplorer({
  spots: rawSpots,
  sections,
  nextTab: _nextTab,
  onNavigateTab: _onNavigateTab,
}: SpotExplorerProps) {
  const spots = rawSpots.map(normalizeSpot);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [activeSection, setActiveSection] = useState(sections?.[0]?.label ?? '');

  const toggleExpand = useCallback((index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  if (spots.length === 0) return null;

  const sectionNav = sections && sections.length > 1
    ? sections.map((s) => ({ id: s.label, label: s.label }))
    : null;

  const activeSectionObj = sections?.find((s) => s.label === activeSection);
  const visibleIndices = activeSectionObj?.spotIndices ?? spots.map((_, i) => i);

  const renderSpotCard = (spotIndex: number, fadeIdx: number) => {
    const spot = spots[spotIndex];
    if (!spot) return null;

    const isExpanded = expanded.has(spotIndex);
    const hasExpandable = spot.tips || spot.mapQuery || spot.bookingSearch || (spot.description && spot.description.length > 80);
    const shortDesc = spot.description
      ? (spot.description.length > 80 && !isExpanded ? spot.description.slice(0, 80) + '...' : spot.description)
      : null;

    return (
      <FadeIn key={spotIndex} index={fadeIdx}>
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <button
            type="button"
            onClick={() => hasExpandable && toggleExpand(spotIndex)}
            className={cn(
              'w-full text-start px-4 py-3 flex items-start gap-3 transition-all duration-150',
              hasExpandable && 'cursor-pointer active:scale-[0.98]',
              !hasExpandable && 'cursor-default',
            )}
            aria-expanded={hasExpandable ? isExpanded : undefined}
          >
            {/* Left: text content */}
            <span className="text-xl shrink-0 mt-0.5" aria-hidden="true">{spot.emoji}</span>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-sm block">{spot.name}</span>
              {shortDesc && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {shortDesc}
                </p>
              )}
              {/* Metadata badges */}
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {spot.cost && (
                  <Badge variant="info" className="text-xs">{spot.cost}</Badge>
                )}
                {spot.duration && (
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                    {spot.duration}
                  </span>
                )}
                {spot.rating != null && spot.rating > 0 && (
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                    <Star className="h-2.5 w-2.5 text-warning fill-warning" aria-hidden="true" />
                    {spot.rating}
                  </span>
                )}
              </div>
              {/* Show more toggle */}
              {hasExpandable && !isExpanded && (
                <span className="text-xs text-primary mt-1 inline-block">Show more</span>
              )}
            </div>

            {/* Right: 72px thumbnail */}
            <div className="shrink-0 flex items-center gap-2">
              {spot.thumbnailUrl && (
                <img
                  src={spot.thumbnailUrl}
                  alt={spot.name}
                  loading="lazy"
                  className="w-[72px] h-[72px] rounded-lg object-cover border border-border/30"
                />
              )}
              {hasExpandable && (
                <span className="text-muted-foreground/50" aria-hidden="true">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
              )}
            </div>
          </button>

          {/* Expanded details */}
          {isExpanded && hasExpandable && (
            <FadeIn>
              <div className="px-4 pb-4 space-y-3">
                {spot.description && spot.description.length > 80 && (
                  <p className="text-sm text-muted-foreground">{spot.description}</p>
                )}
                {spot.tips && (
                  <p className="text-sm text-muted-foreground bg-muted/20 rounded-md p-3">
                    {spot.tips}
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  {spot.mapQuery && <MapLink name={spot.name} query={spot.mapQuery} />}
                  {spot.bookingSearch && (
                    <a
                      href={`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(spot.bookingSearch)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                    >
                      Search Booking
                    </a>
                  )}
                </div>
              </div>
            </FadeIn>
          )}
        </div>
      </FadeIn>
    );
  };

  return (
    <GlassCard className="space-y-4">
      {/* Section navigation */}
      {sectionNav && (
        <SectionNav
          sections={sectionNav}
          activeId={activeSection}
          onSelect={setActiveSection}
        />
      )}

      {/* Section header when sections are active */}
      {sections && sections.length > 1 && activeSectionObj && (
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 px-1">
          {activeSectionObj.label}
        </h3>
      )}

      {/* Spot list */}
      <div className="space-y-1.5">
        {visibleIndices.map((spotIndex, fadeIdx) => renderSpotCard(spotIndex, fadeIdx))}
      </div>

    </GlassCard>
  );
});
