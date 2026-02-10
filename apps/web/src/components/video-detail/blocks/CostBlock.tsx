import { memo, useState } from 'react';
import { DollarSign, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockWrapper } from './BlockWrapper';
import type { CostBlock as CostBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface CostBlockProps {
  block: CostBlockType;
}

/**
 * Renders a cost/price breakdown table with expandable notes.
 */
export const CostBlock = memo(function CostBlock({ block }: CostBlockProps) {
  const items = block.items ?? [];
  const currency = block.currency ?? '$';
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());

  if (items.length === 0) return null;

  const calculatedTotal = items.reduce((sum, item) => sum + item.amount, 0);
  const total = block.total ?? calculatedTotal;

  const formatAmount = (amount: number) => {
    return `${currency}${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const toggleNote = (index: number) => {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <BlockWrapper
      blockId={block.blockId}
      label={BLOCK_LABELS.costs}
      variant="card"
      headerIcon={<DollarSign className="h-4 w-4 shrink-0" aria-hidden="true" />}
      headerLabel={BLOCK_LABELS.costs}
    >
      <div className="space-y-0 stagger-children">
        {items.map((item, index) => {
          const hasNote = !!item.notes;
          const isExpanded = expandedNotes.has(index);

          return (
            <div key={index}>
              <div
                className={cn(
                  'flex items-baseline justify-between gap-3 px-1 py-2 text-sm rounded transition-colors',
                  hasNote ? 'hover:bg-muted/20 cursor-pointer' : 'hover:bg-muted/20'
                )}
                onClick={hasNote ? () => toggleNote(index) : undefined}
                role={hasNote ? 'button' : undefined}
                aria-expanded={hasNote ? isExpanded : undefined}
              >
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  {hasNote && (
                    <ChevronRight
                      className={cn(
                        'h-3 w-3 shrink-0 transition-transform duration-200',
                        isExpanded && 'rotate-90'
                      )}
                      aria-hidden="true"
                    />
                  )}
                  {item.category}
                </span>
                <span className="font-medium tabular-nums">{formatAmount(item.amount)}</span>
              </div>
              {/* Expandable note */}
              {hasNote && (
                <div
                  className={cn(
                    'overflow-hidden transition-all duration-200',
                    isExpanded ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
                  )}
                >
                  <p className="text-xs text-muted-foreground/70 px-1 pb-2 pl-6">
                    {item.notes}
                  </p>
                </div>
              )}
              {index < items.length - 1 && (
                <div className="fade-divider" aria-hidden="true" />
              )}
            </div>
          );
        })}
        {/* Total row with stronger separator */}
        <div className="fade-divider" aria-hidden="true" />
        <div className="fade-divider mt-0.5" aria-hidden="true" />
        <div className="flex items-baseline justify-between gap-3 px-1 py-2.5 text-sm">
          <span className="font-semibold">{BLOCK_LABELS.total}</span>
          <span className="font-bold tabular-nums text-primary text-base text-gradient-primary">{formatAmount(total)}</span>
        </div>
      </div>
    </BlockWrapper>
  );
});
