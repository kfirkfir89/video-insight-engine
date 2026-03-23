import { memo } from 'react';
import { cn } from '@/lib/utils';

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

/**
 * Formatted currency/cost display.
 */
export const CostDisplay = memo(function CostDisplay({
  amount,
  currency = '$',
  label,
  size = 'md',
  className,
}: CostDisplayProps) {
  return (
    <div className={cn('text-center', className)}>
      <span className={cn('font-bold tabular-nums text-foreground', SIZE_CLASSES[size])}>
        {currency} {amount.toLocaleString()}
      </span>
      {label && <p className="text-xs text-muted-foreground mt-1">{label}</p>}
    </div>
  );
});
