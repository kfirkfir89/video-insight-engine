import { memo } from 'react';
import { DollarSign } from 'lucide-react';
import { BlockWrapper } from './BlockWrapper';
import type { CostBlock as CostBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface CostBlockProps {
  block: CostBlockType;
}

/**
 * Renders a cost/price breakdown table.
 */
export const CostBlock = memo(function CostBlock({ block }: CostBlockProps) {
  const items = block.items ?? [];
  const currency = block.currency ?? '$';

  if (items.length === 0) return null;

  const calculatedTotal = items.reduce((sum, item) => sum + item.amount, 0);
  const total = block.total ?? calculatedTotal;

  const formatAmount = (amount: number) => {
    return `${currency}${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  return (
    <BlockWrapper
      blockId={block.blockId}
      label={BLOCK_LABELS.costs}
    >
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <div className="bg-muted/30 px-4 py-2 border-b border-border/50 flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-medium">{BLOCK_LABELS.costs}</span>
        </div>

        <table className="w-full text-sm">
          <thead className="sr-only">
            <tr>
              <th>Category</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {items.map((item, index) => (
              <tr key={index} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-2 text-muted-foreground">
                  {item.category}
                  {item.notes && (
                    <span className="text-xs text-muted-foreground/60 ml-1">({item.notes})</span>
                  )}
                </td>
                <td className="px-4 py-2 font-medium text-right tabular-nums">
                  {formatAmount(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/20">
            <tr>
              <td className="px-4 py-2 font-medium">{BLOCK_LABELS.total}</td>
              <td className="px-4 py-2 font-bold text-right tabular-nums text-[var(--category-accent)]">
                {formatAmount(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </BlockWrapper>
  );
});
