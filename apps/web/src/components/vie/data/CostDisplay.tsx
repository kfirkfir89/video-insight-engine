import { memo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useCountUp } from '@/hooks/use-count-up';

interface CostDisplayProps {
  amount: number;
  currency?: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
} as const;

export const CostDisplay = memo(function CostDisplay({
  amount,
  currency = '$',
  label,
  size = 'md',
  className,
}: CostDisplayProps) {
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    // Guard the `.matches` read — matchMedia itself is optional-chained, but
    // an undefined return would throw on the subsequent property access.
    return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  });
  useEffect(() => {
    if (visible) return;
    const f = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(f);
  }, [visible]);

  const value = useCountUp(visible ? amount : 0, { duration: 900, enabled: visible });

  return (
    <div className={cn('text-center animate-fade-up', className)}>
      <span className={cn('vie-count-up font-semibold tracking-tight text-primary', SIZE_CLASSES[size])}>
        {currency} {Math.round(value).toLocaleString()}
      </span>
      {label && <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mt-1.5">{label}</p>}
    </div>
  );
});
