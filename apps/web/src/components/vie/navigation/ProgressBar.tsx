import { memo } from 'react';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  color?: string;
  animated?: boolean;
  /** Show moving highlight beam along the fill. Default true. */
  beam?: boolean;
  className?: string;
}

export const ProgressBar = memo(function ProgressBar({
  value,
  max,
  label,
  color,
  animated = true,
  beam = true,
  className,
}: ProgressBarProps) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const fillColor = color || 'var(--primary)';

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
        <div
          className={cn('relative h-full rounded-full', beam && 'vie-progress-beam')}
          style={{
            backgroundColor: fillColor,
            width: `${percent}%`,
            transition: animated
              ? 'width 900ms cubic-bezier(0.16, 1, 0.3, 1)'
              : 'none',
          }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={label ?? `${Math.round(percent)}% complete`}
        />
      </div>
      <span className="text-xs font-medium tabular-nums text-muted-foreground w-10 text-end">
        {Math.round(percent)}%
      </span>
    </div>
  );
});
