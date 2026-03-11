import { memo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard } from '../GlassCard';
import { CrossTabLink } from '../CrossTabLink';
import type { ReviewComparison } from '@vie/types';

interface ComparisonInteractiveProps {
  comparisons: ReviewComparison[];
  pros?: string[];
  cons?: string[];
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

export const ComparisonInteractive = memo(function ComparisonInteractive({
  comparisons,
  pros,
  cons,
  nextTab,
  onNavigateTab,
}: ComparisonInteractiveProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const hasComparisons = comparisons.length > 0;
  const hasPros = pros && pros.length > 0;
  const hasCons = cons && cons.length > 0;
  const competitorName = hasComparisons ? comparisons[0].competitorName : '';

  if (!hasComparisons && !hasPros && !hasCons) return null;

  return (
    <div className="space-y-4">
      {/* Feature comparison table */}
      {hasComparisons && (
        <GlassCard variant="default" className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left text-xs font-bold uppercase tracking-wider text-muted-foreground px-4 py-2.5">
                  Feature
                </th>
                <th className="text-left text-xs font-bold uppercase tracking-wider text-primary px-4 py-2.5">
                  This Product
                </th>
                <th className="text-left text-xs font-bold uppercase tracking-wider text-muted-foreground px-4 py-2.5">
                  {competitorName || 'Competitor'}
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((item, index) => (
                <tr
                  key={index}
                  className={cn(
                    'border-b border-border/30 cursor-pointer transition-colors',
                    index === activeIndex
                      ? 'bg-primary/5'
                      : 'hover:bg-muted/30',
                  )}
                  onClick={() => setActiveIndex(index)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setActiveIndex(index)}
                >
                  <td className="px-4 py-2.5 font-medium text-foreground">
                    {item.feature}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {item.thisProduct}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {item.competitor}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}

      {/* Pros and Cons */}
      {(hasPros || hasCons) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {hasPros && (
            <GlassCard variant="outlined" className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-success flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Pros
              </h4>
              <ul className="space-y-1.5">
                {pros.map((pro, i) => (
                  <li key={i} className="flex items-baseline gap-2 text-sm text-muted-foreground">
                    <span className="w-1 h-1 rounded-full bg-success/70 shrink-0 translate-y-1.5" />
                    {pro}
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}

          {hasCons && (
            <GlassCard variant="outlined" className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-destructive flex items-center gap-1.5">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Cons
              </h4>
              <ul className="space-y-1.5">
                {cons.map((con, i) => (
                  <li key={i} className="flex items-baseline gap-2 text-sm text-muted-foreground">
                    <span className="w-1 h-1 rounded-full bg-destructive/70 shrink-0 translate-y-1.5" />
                    {con}
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}
        </div>
      )}

      {nextTab && onNavigateTab && (
        <CrossTabLink tabId={nextTab} label="Next section" onNavigate={onNavigateTab} />
      )}
    </div>
  );
});
