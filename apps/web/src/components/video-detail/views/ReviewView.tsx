import { memo, useMemo } from 'react';
import { Clock } from 'lucide-react';
import type { SummaryChapter, ContentBlock } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';

interface ReviewViewProps {
  chapter: SummaryChapter;
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isVideoActive?: boolean;
  activeStartSeconds?: number;
}

/**
 * Specialized view for product review content.
 * Emphasizes:
 * - Verdict/overall assessment at the top
 * - Rating breakdown
 * - Pros and cons
 * - Comparison highlights
 */
export const ReviewView = memo(function ReviewView({
  chapter,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
}: ReviewViewProps) {
  // Group blocks by type for review-optimized layout
  const { verdictBlocks, ratingBlocks, proConBlocks, comparisonBlocks, timestampBlocks, otherBlocks } = useMemo(() => {
    const verdicts: ContentBlock[] = [];
    const ratings: ContentBlock[] = [];
    const proCons: ContentBlock[] = [];
    const comparisons: ContentBlock[] = [];
    const timestamps: ContentBlock[] = [];
    const other: ContentBlock[] = [];

    for (const block of chapter.content ?? []) {
      if (block.type === 'verdict') {
        verdicts.push(block);
      } else if (block.type === 'rating') {
        ratings.push(block);
      } else if (block.type === 'pro_con') {
        proCons.push(block);
      } else if (block.type === 'comparison') {
        comparisons.push(block);
      } else if (block.type === 'timestamp') {
        timestamps.push(block);
      } else {
        other.push(block);
      }
    }

    return {
      verdictBlocks: verdicts,
      ratingBlocks: ratings,
      proConBlocks: proCons,
      comparisonBlocks: comparisons,
      timestampBlocks: timestamps,
      otherBlocks: other,
    };
  }, [chapter.content]);

  const hasVerdicts = verdictBlocks.length > 0;
  const hasRatings = ratingBlocks.length > 0;
  const hasProCons = proConBlocks.length > 0;
  const hasComparisons = comparisonBlocks.length > 0;
  const hasTimestamps = timestampBlocks.length > 0;
  const hasOtherBlocks = otherBlocks.length > 0;

  // Early return for empty content
  if (!hasVerdicts && !hasRatings && !hasProCons && !hasComparisons && !hasTimestamps && !hasOtherBlocks) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Verdict Section - Final assessment at the top */}
      {hasVerdicts && (
        <ContentBlocks
          blocks={verdictBlocks}
          onPlay={onPlay}
          onStop={onStop}
          isVideoActive={isVideoActive}
          activeStartSeconds={activeStartSeconds}
        />
      )}

      {/* Ratings Section */}
      {hasRatings && (
        <ContentBlocks
          blocks={ratingBlocks}
          onPlay={onPlay}
          onStop={onStop}
          isVideoActive={isVideoActive}
          activeStartSeconds={activeStartSeconds}
        />
      )}

      {/* Pros & Cons Section */}
      {hasProCons && (
        <ContentBlocks
          blocks={proConBlocks}
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

      {/* Comparison Section */}
      {hasComparisons && (
        <ContentBlocks
          blocks={comparisonBlocks}
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
            <Clock className="h-4 w-4" aria-hidden="true" />
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
    </div>
  );
});
