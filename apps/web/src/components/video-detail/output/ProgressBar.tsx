import { memo } from 'react';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  className?: string;
}

/**
 * Linear progress bar with animated fill and percentage label.
 */
export const ProgressBar = memo(function ProgressBar({ value, max, label, className }: ProgressBarProps) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={label ?? `${percent}% complete`}
        />
      </div>
      <span className="text-xs font-medium tabular-nums text-muted-foreground w-10 text-right">
        {percent}%
      </span>
    </div>
  );
});
