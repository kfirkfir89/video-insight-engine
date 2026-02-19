import { memo } from 'react';
import { Star, StarHalf } from 'lucide-react';
import { BlockWrapper } from './BlockWrapper';
import type { RatingBlock as RatingBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface RatingBlockProps {
  block: RatingBlockType;
}

/**
 * Renders a rating display with stars or score.
 */
export const RatingBlock = memo(function RatingBlock({ block }: RatingBlockProps) {
  const { score, maxScore, label, breakdown } = block;

  // Clamp score to valid range
  const clampedScore = Math.max(0, Math.min(score, maxScore));

  // Render stars for 5-point scale
  const renderStars = (value: number, max: number) => {
    const fullStars = Math.floor(value);
    const hasHalfStar = value % 1 >= 0.5;
    const emptyStars = max - fullStars - (hasHalfStar ? 1 : 0);

    return (
      <div className="flex items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: fullStars }).map((_, i) => (
          <Star key={`full-${i}`} className="h-4 w-4 shrink-0 fill-warning text-warning dark:drop-shadow-[0_0_6px_oklch(78%_0.14_85/0.4)]" />
        ))}
        {hasHalfStar && <StarHalf className="h-4 w-4 shrink-0 fill-warning text-warning dark:drop-shadow-[0_0_6px_oklch(78%_0.14_85/0.4)]" />}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <Star key={`empty-${i}`} className="h-4 w-4 shrink-0 text-muted-foreground/40" />
        ))}
      </div>
    );
  };

  // Render progress bar for other scales
  const renderBar = (value: number, max: number) => {
    const percentage = (value / max) * 100;
    return (
      <div className="flex items-center gap-2 flex-1">
        <div className="flex-1 h-2 bg-muted/50 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out bg-warning progress-bar-gradient progress-bar-animated"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-sm font-medium tabular-nums w-12 text-right">
          {value}/{max}
        </span>
      </div>
    );
  };

  return (
    <BlockWrapper
      blockId={block.blockId}
      label={BLOCK_LABELS.rating(clampedScore, maxScore)}
      variant="transparent"
    >
      <div className="block-label-minimal">
        <Star className="h-3 w-3" aria-hidden="true" />
        <span>Rating</span>
      </div>
      <div className="space-y-4">
        {/* Main rating */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            {label && <span className="text-sm text-muted-foreground">{label}</span>}
            <div className="flex items-center gap-3">
              <span
                className="text-4xl font-black tabular-nums text-gradient-warm"
                aria-label={BLOCK_LABELS.rating(clampedScore, maxScore)}
              >
                {clampedScore}
              </span>
              <span className="text-lg text-muted-foreground/40">/ {maxScore}</span>
            </div>
          </div>
          {maxScore <= 5 ? renderStars(clampedScore, maxScore) : renderBar(clampedScore, maxScore)}
        </div>

        {/* Breakdown */}
        {breakdown && breakdown.length > 0 && (
          <>
            <div className="fade-divider" aria-hidden="true" />
            <div className="space-y-2">
              {breakdown.map((item, index) => (
                <div key={index} className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground w-24 shrink-0 truncate">{item.category}</span>
                  <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-warning/90 rounded-full progress-bar-gradient"
                      style={{ width: `${(item.score / (item.maxScore || maxScore)) * 100}%`, animationDelay: `${index * 80}ms` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">
                    {item.score}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </BlockWrapper>
  );
});
