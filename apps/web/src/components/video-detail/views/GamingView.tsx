import { memo, useMemo } from 'react';
import { Trophy, Target, Clock, Lightbulb } from 'lucide-react';
import type { Section, ContentBlock } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';

interface GamingViewProps {
  section: Section;
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isVideoActive?: boolean;
  activeStartSeconds?: number;
}

/**
 * Specialized view for gaming content.
 * Emphasizes:
 * - Strategies and tactics at the top
 * - Key moments/highlights
 * - Tips and tricks
 * - Video timestamps for gameplay
 */
export const GamingView = memo(function GamingView({
  section,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
}: GamingViewProps) {
  // Group blocks by type for gaming-optimized layout
  const { strategyBlocks, highlightBlocks, tipBlocks, timestampBlocks, otherBlocks } = useMemo(() => {
    const strategies: ContentBlock[] = [];
    const highlights: ContentBlock[] = [];
    const tips: ContentBlock[] = [];
    const timestamps: ContentBlock[] = [];
    const other: ContentBlock[] = [];

    for (const block of section.content ?? []) {
      if (block.type === 'numbered' && block.variant === 'strategy') {
        strategies.push(block);
      } else if (block.type === 'bullets' && block.variant === 'highlights') {
        highlights.push(block);
      } else if (block.type === 'callout' && (block.variant === 'pro_tip' || block.variant === 'strategy_tip')) {
        tips.push(block);
      } else if (block.type === 'timestamp') {
        timestamps.push(block);
      } else {
        other.push(block);
      }
    }

    return {
      strategyBlocks: strategies,
      highlightBlocks: highlights,
      tipBlocks: tips,
      timestampBlocks: timestamps,
      otherBlocks: other,
    };
  }, [section.content]);

  const hasStrategies = strategyBlocks.length > 0;
  const hasHighlights = highlightBlocks.length > 0;
  const hasTips = tipBlocks.length > 0;
  const hasTimestamps = timestampBlocks.length > 0;
  const hasOtherBlocks = otherBlocks.length > 0;

  // Early return for empty content
  if (!hasStrategies && !hasHighlights && !hasTips && !hasTimestamps && !hasOtherBlocks) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Strategies Section */}
      {hasStrategies && (
        <div className="bg-violet-50/50 dark:bg-violet-950/20 rounded-lg p-4 border border-violet-200/50 dark:border-violet-800/30">
          <h4 className="flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-300 mb-3">
            <Target className="h-4 w-4" aria-hidden="true" />
            <span>Strategies</span>
          </h4>
          <ContentBlocks
            blocks={strategyBlocks}
            onPlay={onPlay}
            onStop={onStop}
            isVideoActive={isVideoActive}
            activeStartSeconds={activeStartSeconds}
          />
        </div>
      )}

      {/* Highlights Section */}
      {hasHighlights && (
        <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-lg p-4 border border-amber-200/50 dark:border-amber-800/30">
          <h4 className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300 mb-3">
            <Trophy className="h-4 w-4" aria-hidden="true" />
            <span>Highlights</span>
          </h4>
          <ContentBlocks
            blocks={highlightBlocks}
            onPlay={onPlay}
            onStop={onStop}
            isVideoActive={isVideoActive}
            activeStartSeconds={activeStartSeconds}
          />
        </div>
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

      {/* Key Moments Timestamps */}
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

      {/* Tips & Tricks */}
      {hasTips && (
        <div className="mt-4 space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-medium text-violet-600 dark:text-violet-400 mb-2">
            <Lightbulb className="h-4 w-4" aria-hidden="true" />
            <span>Tips & Tricks</span>
          </h4>
          <ContentBlocks
            blocks={tipBlocks}
            onPlay={onPlay}
            onStop={onStop}
            isVideoActive={isVideoActive}
            activeStartSeconds={activeStartSeconds}
          />
        </div>
      )}
    </div>
  );
});
