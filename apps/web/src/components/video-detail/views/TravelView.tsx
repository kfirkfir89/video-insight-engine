import { memo, useMemo } from 'react';
import { Compass } from 'lucide-react';
import type { SummaryChapter, ContentBlock } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';

interface TravelViewProps {
  chapter: SummaryChapter;
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isVideoActive?: boolean;
  activeStartSeconds?: number;
}

/**
 * Specialized view for travel content.
 * Emphasizes:
 * - Location highlights at the top
 * - Itinerary/day-by-day plans
 * - Cost breakdowns
 * - Travel tips and callouts
 */
export const TravelView = memo(function TravelView({
  chapter,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
}: TravelViewProps) {
  // Group blocks by type for travel-optimized layout
  const { locationBlocks, itineraryBlocks, costBlocks, tipBlocks, timestampBlocks, otherBlocks } = useMemo(() => {
    const locations: ContentBlock[] = [];
    const itinerary: ContentBlock[] = [];
    const costs: ContentBlock[] = [];
    const tips: ContentBlock[] = [];
    const timestamps: ContentBlock[] = [];
    const other: ContentBlock[] = [];

    for (const block of chapter.content ?? []) {
      if (block.type === 'location') {
        locations.push(block);
      } else if (block.type === 'itinerary') {
        itinerary.push(block);
      } else if (block.type === 'cost') {
        costs.push(block);
      } else if (block.type === 'callout' && block.variant === 'travel_tip') {
        tips.push(block);
      } else if (block.type === 'timestamp') {
        timestamps.push(block);
      } else {
        other.push(block);
      }
    }

    return {
      locationBlocks: locations,
      itineraryBlocks: itinerary,
      costBlocks: costs,
      tipBlocks: tips,
      timestampBlocks: timestamps,
      otherBlocks: other,
    };
  }, [chapter.content]);

  const hasLocations = locationBlocks.length > 0;
  const hasItinerary = itineraryBlocks.length > 0;
  const hasCosts = costBlocks.length > 0;
  const hasTips = tipBlocks.length > 0;
  const hasTimestamps = timestampBlocks.length > 0;
  const hasOtherBlocks = otherBlocks.length > 0;

  // Early return for empty content
  if (!hasLocations && !hasItinerary && !hasCosts && !hasTips && !hasTimestamps && !hasOtherBlocks) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Locations Section - Destinations at the top */}
      {hasLocations && (
        <ContentBlocks
          blocks={locationBlocks}
          onPlay={onPlay}
          onStop={onStop}
          isVideoActive={isVideoActive}
          activeStartSeconds={activeStartSeconds}
        />
      )}

      {/* Main content (non-categorized blocks) */}
      {hasOtherBlocks && (
        <ContentBlocks
          blocks={otherBlocks}
          onPlay={onPlay}
          onStop={onStop}
          isVideoActive={isVideoActive}
          activeStartSeconds={activeStartSeconds}
        />
      )}

      {/* Itinerary Section */}
      {hasItinerary && (
        <ContentBlocks
          blocks={itineraryBlocks}
          onPlay={onPlay}
          onStop={onStop}
          isVideoActive={isVideoActive}
          activeStartSeconds={activeStartSeconds}
        />
      )}

      {/* Cost Breakdown Section */}
      {hasCosts && (
        <ContentBlocks
          blocks={costBlocks}
          onPlay={onPlay}
          onStop={onStop}
          isVideoActive={isVideoActive}
          activeStartSeconds={activeStartSeconds}
        />
      )}

      {/* Timestamps for Key Moments */}
      {hasTimestamps && (
        <div className="mt-3">
          <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
            <Compass className="h-4 w-4" aria-hidden="true" />
            <span>Key Moments</span>
          </h4>
          <div className="flex flex-wrap gap-2">
            <ContentBlocks
              blocks={timestampBlocks}
              onPlay={onPlay}
              onStop={onStop}
              isVideoActive={isVideoActive}
              activeStartSeconds={activeStartSeconds}
            />
          </div>
        </div>
      )}

      {/* Travel Tips */}
      {hasTips && (
        <ContentBlocks
          blocks={tipBlocks}
          onPlay={onPlay}
          onStop={onStop}
          isVideoActive={isVideoActive}
          activeStartSeconds={activeStartSeconds}
        />
      )}
    </div>
  );
});
