import { memo, useMemo } from 'react';
import { ThumbsUp, ThumbsDown, Star, Award, Clock, Lightbulb } from 'lucide-react';
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
    <div className="space-y-4">
      {/* Verdict Section - Final assessment at the top */}
      {hasVerdicts && (
        <div className="bg-violet-50/50 dark:bg-violet-950/20 rounded-lg p-4 border border-violet-200/50 dark:border-violet-800/30">
          <h4 className="flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-300 mb-3">
            <Award className="h-4 w-4" aria-hidden="true" />
            <span>Verdict</span>
          </h4>
          <ContentBlocks
            blocks={verdictBlocks}
            onPlay={onPlay}
            onStop={onStop}
            isVideoActive={isVideoActive}
            activeStartSeconds={activeStartSeconds}
          />
        </div>
      )}

      {/* Ratings Section */}
      {hasRatings && (
        <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-lg p-4 border border-amber-200/50 dark:border-amber-800/30">
          <h4 className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300 mb-3">
            <Star className="h-4 w-4" aria-hidden="true" />
            <span>Ratings</span>
          </h4>
          <ContentBlocks
            blocks={ratingBlocks}
            onPlay={onPlay}
            onStop={onStop}
            isVideoActive={isVideoActive}
            activeStartSeconds={activeStartSeconds}
          />
        </div>
      )}

      {/* Pros & Cons Section */}
      {hasProCons && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg p-4 border border-emerald-200/50 dark:border-emerald-800/30">
            <h4 className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-3">
              <ThumbsUp className="h-4 w-4" aria-hidden="true" />
              <span>What We Liked</span>
            </h4>
          </div>
          <div className="bg-rose-50/50 dark:bg-rose-950/20 rounded-lg p-4 border border-rose-200/50 dark:border-rose-800/30">
            <h4 className="flex items-center gap-2 text-sm font-medium text-rose-700 dark:text-rose-300 mb-3">
              <ThumbsDown className="h-4 w-4" aria-hidden="true" />
              <span>What Could Be Better</span>
            </h4>
          </div>
        </div>
      )}
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
        <div className="bg-slate-50/50 dark:bg-slate-950/20 rounded-lg p-4 border border-slate-200/50 dark:border-slate-800/30">
          <h4 className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
            <Lightbulb className="h-4 w-4" aria-hidden="true" />
            <span>Comparison</span>
          </h4>
          <ContentBlocks
            blocks={comparisonBlocks}
            onPlay={onPlay}
            onStop={onStop}
            isVideoActive={isVideoActive}
            activeStartSeconds={activeStartSeconds}
          />
        </div>
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
