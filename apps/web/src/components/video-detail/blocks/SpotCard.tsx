import { memo, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, ExternalLink, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BlockWrapper } from './BlockWrapper';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface Spot {
  icon?: string;
  emoji?: string;
  name: string;
  subtitle?: string;
  description?: string;
  cost?: string;
  currency?: string;
  tip?: string;
  tips?: string;
  mapsQuery?: string;
  mapQuery?: string;
  bookingSearch?: string;
  duration?: string;
  specs?: string;
  rating?: number;
}

interface SpotCardProps {
  spot: Spot;
}

/**
 * Expandable card for spots, restaurants, gear, or products.
 * Collapsed: emoji + title + subtitle + cost badge.
 * Expanded: tip text + action buttons (Maps, Booking).
 */
export const SpotCard = memo(function SpotCard({ spot }: SpotCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Support both SpotItem (vie-response.ts) and legacy prop names
  const icon = spot.icon || spot.emoji;
  const tipText = spot.tip || spot.tips;
  const mapsQuery = spot.mapsQuery || spot.mapQuery;

  const hasCost = !!spot.cost;
  const hasExpandableContent = tipText || mapsQuery || spot.bookingSearch;

  return (
    <BlockWrapper variant="transparent">
      <div className="rounded-lg border border-border/50 overflow-hidden">
        {/* Collapsed header — always visible */}
        <Button
          variant="ghost"
          size="bare"
          onClick={() => hasExpandableContent && setExpanded(prev => !prev)}
          className={cn(
            'w-full text-left px-4 py-3 flex items-center gap-3 transition-all duration-150',
            hasExpandableContent && 'cursor-pointer active:scale-[0.97]',
            !hasExpandableContent && 'cursor-default'
          )}
          aria-expanded={hasExpandableContent ? expanded : undefined}
          aria-label={`${spot.name}${spot.subtitle ? ` — ${spot.subtitle}` : ''}`}
        >
          {/* Emoji icon */}
          {icon && (
            <span className="text-xl shrink-0" aria-hidden="true">{icon}</span>
          )}

          {/* Title + subtitle */}
          <div className="flex-1 min-w-0">
            <span className="font-medium text-sm block truncate">{spot.name}</span>
            {spot.subtitle && (
              <span className="text-xs text-muted-foreground block truncate">{spot.subtitle}</span>
            )}
          </div>

          {/* Rating stars */}
          {spot.rating !== undefined && spot.rating > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              <Star className="h-3.5 w-3.5 text-warning fill-warning" aria-hidden="true" />
              <span className="text-xs font-medium tabular-nums">{spot.rating}</span>
            </div>
          )}

          {/* Specs badge */}
          {spot.specs && (
            <span className="text-xs text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full shrink-0">
              {spot.specs}
            </span>
          )}

          {/* Cost badge */}
          {hasCost && (
            <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
              {spot.currency && `${spot.currency} `}{spot.cost}
            </span>
          )}

          {/* Expand chevron */}
          {hasExpandableContent && (
            <span className="shrink-0 text-muted-foreground/50" aria-hidden="true">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          )}
        </Button>

        {/* Expanded content */}
        {expanded && hasExpandableContent && (
          <div className="animate-[fadeUp_0.2s_ease-out_both] px-4 pb-4 space-y-3">
            {tipText && (
              <p className="text-sm text-muted-foreground bg-muted/20 rounded-md p-3">
                {tipText}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {mapsQuery && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {BLOCK_LABELS.openInMaps}
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
                  {BLOCK_LABELS.searchBooking}
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </BlockWrapper>
  );
});
