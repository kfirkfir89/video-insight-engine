import { memo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatPillProps {
  value: string;
  label: string;
  context?: string;
  trend?: 'up' | 'down' | 'neutral';
  onClick?: () => void;
  className?: string;
}

interface TrendIconProps {
  trend: 'up' | 'down' | 'neutral';
}

function TrendIcon({ trend }: TrendIconProps) {
  switch (trend) {
    case 'up':
      return <TrendingUp className="h-3 w-3 shrink-0 text-success" aria-hidden="true" />;
    case 'down':
      return <TrendingDown className="h-3 w-3 shrink-0 text-destructive" aria-hidden="true" />;
    case 'neutral':
      return <Minus className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />;
  }
}

/**
 * StatPill — eyebrow label, then a left-aligned value. The hierarchy is
 * flipped from the AI-stock hero-metric layout (big-number-centered, tiny
 * uppercase caption). Trend sign renders inline next to the value rather
 * than as a standalone arrow.
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
        'flex flex-col items-start text-start px-3.5 py-2.5 rounded-md transition-colors animate-fade-up',
        onClick && 'cursor-pointer hover:bg-muted/20 hover:-translate-y-0.5 transition-transform duration-200 ease-[var(--ease-out-expo)] motion-reduce:hover:translate-y-0 motion-reduce:transition-none',
        className,
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80 leading-none">
        {label}
      </span>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tabular-nums text-foreground leading-none animate-counter-pop">
          {value}
        </span>
        {trend && <TrendIcon trend={trend} />}
      </div>
      {context && (
        <span className="mt-1 text-xs text-muted-foreground/70 leading-snug">
          {context}
        </span>
      )}
    </Wrapper>
  );
});
