import { memo } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatPillProps {
  value: string;
  label: string;
  context?: string;
  trend?: 'up' | 'down' | 'neutral';
  onClick?: () => void;
  className?: string;
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'neutral' }) {
  switch (trend) {
    case 'up':
      return <TrendingUp className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />;
    case 'down':
      return <TrendingDown className="h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />;
    case 'neutral':
      return <Minus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />;
  }
}

/**
 * Single statistic display with optional trend indicator.
 * Domain-free replacement for StatBlock.
 */
export const StatPill = memo(function StatPill({
  value,
  label,
  context,
  trend,
  onClick,
  className,
}: StatPillProps) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        'flex-col items-center text-center px-4 py-2 rounded-md transition-colors',
        onClick && 'cursor-pointer hover:bg-muted/20',
        className,
      )}
    >
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-black tabular-nums text-gradient-primary">{value}</span>
        {trend && <TrendIcon trend={trend} />}
      </div>
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground mt-1">
        {label}
      </span>
      {context && (
        <span className="text-xs text-muted-foreground/70 mt-0.5">{context}</span>
      )}
    </Wrapper>
  );
});
