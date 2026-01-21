import { memo } from 'react';
import type { StatisticBlock } from '@vie/types';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatisticRendererProps {
  block: StatisticBlock;
}

// Extracted outside component to avoid recreation on each render
function TrendIcon({ trend }: { trend?: 'up' | 'down' | 'neutral' }) {
  switch (trend) {
    case 'up':
      return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />;
    case 'down':
      return <TrendingDown className="h-3.5 w-3.5 text-rose-500" aria-hidden="true" />;
    case 'neutral':
      return <Minus className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />;
    default:
      return null;
  }
}

/**
 * Renders a statistic block with inline metrics.
 * Variants: metric (default), percentage, trend
 */
export const StatisticRenderer = memo(function StatisticRenderer({ block }: StatisticRendererProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {block.items.map((item, index) => (
        <div key={index} className="flex items-baseline gap-2 p-3 rounded-lg bg-muted/40 border border-border/40">
          <span className="text-xl font-semibold tabular-nums">{item.value}</span>
          {item.trend && <TrendIcon trend={item.trend} />}
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-muted-foreground">{item.label}</span>
            {item.context && (
              <span className="text-xs text-muted-foreground/60">{item.context}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
});
