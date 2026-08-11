import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard, Badge } from '@/components/vie';

import type { ComparisonRow } from './types';

interface ComparisonTableProps {
  comparisons: ComparisonRow[];
  colLeft: string;
  colRight: string;
  activeRow: number;
  onSelectRow: (index: number) => void;
}

/** Feature comparison — table mode. */
export function ComparisonTable({
  comparisons,
  colLeft,
  colRight,
  activeRow,
  onSelectRow,
}: ComparisonTableProps) {
  return (
    <GlassCard variant="default" className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2.5">Feature</th>
              <th className="text-start text-xs font-semibold uppercase tracking-wider text-[var(--vie-accent)] px-4 py-2.5">{colLeft}</th>
              <th className="text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2.5">{colRight}</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((item, index) => {
              const isLeftWinner = item.winner === 'left';
              const isRightWinner = item.winner === 'right';
              return (
                <tr
                  key={index}
                  className={cn(
                    'border-b border-border/30 cursor-pointer transition-colors',
                    index === activeRow ? 'bg-[var(--vie-accent)]/5' : 'hover:bg-muted/30',
                  )}
                  onClick={() => onSelectRow(index)}
                >
                  <td className="px-4 py-2.5 text-sm font-semibold leading-snug">
                    {item.feature}
                    {item.winner === 'tie' && (
                      <Badge variant="muted" className="ms-2 text-xs font-medium">Tie</Badge>
                    )}
                  </td>
                  <td className={cn(
                    'px-4 py-2.5 text-sm leading-relaxed',
                    isLeftWinner ? 'text-success font-semibold' : 'text-muted-foreground',
                  )}>
                    {item.thisProduct}
                    {isLeftWinner && <Check className="inline h-3.5 w-3.5 ms-1 text-success" aria-hidden="true" />}
                  </td>
                  <td className={cn(
                    'px-4 py-2.5 text-sm leading-relaxed',
                    isRightWinner ? 'text-success font-semibold' : 'text-muted-foreground',
                  )}>
                    {item.competitor}
                    {isRightWinner && <Check className="inline h-3.5 w-3.5 ms-1 text-success" aria-hidden="true" />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
