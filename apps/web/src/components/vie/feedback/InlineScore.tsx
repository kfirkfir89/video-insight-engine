import { memo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useCountUp } from '@/hooks/use-count-up';

interface InlineScoreProps {
  correct: number;
  total: number;
  className?: string;
}

export const InlineScore = memo(function InlineScore({
  correct,
  total,
  className,
}: InlineScoreProps) {
  const [visible, setVisible] = useState<boolean>(() => {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    );
  });
  useEffect(() => {
    if (visible) return;
    const f = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(f);
  }, [visible]);

  const count = useCountUp(visible ? correct : 0, { duration: 700, enabled: visible });
  const ratio = total > 0 ? correct / total : 0;
  const colorClass = ratio >= 0.8 ? 'text-success' : ratio >= 0.5 ? 'text-warning' : 'text-destructive';

  return (
    <span
      key={`${correct}-${total}`}
      className={cn(
        'vie-count-up font-semibold tracking-tight inline-flex items-baseline animate-counter-pop',
        colorClass,
        className,
      )}
    >
      {Math.round(count)}/{total}
    </span>
  );
});
