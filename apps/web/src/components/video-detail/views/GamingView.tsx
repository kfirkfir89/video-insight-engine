import { memo, useMemo } from 'react';
import { Trophy, Target, Clock, Lightbulb } from 'lucide-react';
import type { SummaryChapter, ContentBlock } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';

interface GamingViewProps {
  chapter: SummaryChapter;
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
  chapter,
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

    for (const block of chapter.content ?? []) {
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
  }, [chapter.content]);

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
        <div className="glass-panel block-entrance" style={{ animationDelay: '0ms' }}>
          <h4 className="glass-section-header">
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
        <div className="glass-panel block-entrance" style={{ animationDelay: '100ms' }}>
          <h4 className="glass-section-header">
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
          <h4 className="glass-section-header">
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
