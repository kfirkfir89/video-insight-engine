import { memo } from 'react';
import { cn } from '@/lib/utils';

interface InlineScoreProps {
  correct: number;
  total: number;
  className?: string;
}

/**
 * Inline score display (e.g. "3/5").
 * Color shifts from destructive to success based on ratio.
 */
export const InlineScore = memo(function InlineScore({
  correct,
  total,
  className,
}: InlineScoreProps) {
  const ratio = total > 0 ? correct / total : 0;
  const colorClass = ratio >= 0.8 ? 'text-success' : ratio >= 0.5 ? 'text-warning' : 'text-destructive';

  return (
    <span className={cn('font-semibold tabular-nums tracking-tight', colorClass, className)}>
      {correct}/{total}
    </span>
  );
});
