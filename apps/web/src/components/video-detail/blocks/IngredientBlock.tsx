import { memo, useState } from 'react';
import { UtensilsCrossed, Check, Square, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockWrapper } from './BlockWrapper';
import { Button } from '@/components/ui/button';
import type { IngredientBlock as IngredientBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface IngredientBlockProps {
  block: IngredientBlockType;
}

/**
 * Renders a recipe ingredient list with checkbox tracking and optional serving scaler.
 */
export const IngredientBlock = memo(function IngredientBlock({ block }: IngredientBlockProps) {
  const items = block.items ?? [];
  const baseServings = block.servings ?? 4;

  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [servingMultiplier, setServingMultiplier] = useState(1);

  if (items.length === 0) return null;

  const currentServings = baseServings * servingMultiplier;

  const toggleItem = (index: number) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const scaleAmount = (amount: string | undefined): string | undefined => {
    if (!amount) return undefined;
    // Try to parse and scale numeric amounts
    const match = amount.match(/^([\d./]+)\s*(.*)$/);
    if (match) {
      const [, numPart, rest] = match;
      // Handle fractions like "1/2"
      let value: number;
      if (numPart.includes('/')) {
        const [num, denom] = numPart.split('/');
        value = Number(num) / Number(denom);
      } else {
        value = Number(numPart);
      }
      if (!isNaN(value)) {
        const scaled = value * servingMultiplier;
        // Format nicely (avoid 1.0, show 1.5, etc.)
        const formatted = scaled % 1 === 0 ? scaled.toString() : scaled.toFixed(1);
        return `${formatted}${rest ? ' ' + rest : ''}`;
      }
    }
    return amount;
  };

  return (
    <BlockWrapper
      blockId={block.blockId}
      label={BLOCK_LABELS.ingredients}
    >
      <div className="space-y-3 p-4 rounded-lg bg-[var(--category-surface,rgba(255,107,53,0.08))] border border-[var(--category-accent,#FF6B35)]/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <UtensilsCrossed className="h-4 w-4 text-[var(--category-accent,#FF6B35)]" aria-hidden="true" />
            <span className="text-sm font-medium text-[var(--category-accent,#FF6B35)]">
              {BLOCK_LABELS.ingredients}
            </span>
          </div>

          {/* Serving scaler */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{BLOCK_LABELS.servings}:</span>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setServingMultiplier(Math.max(0.5, servingMultiplier - 0.5))}
                disabled={servingMultiplier <= 0.5}
                aria-label="Decrease servings"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="text-sm font-medium w-8 text-center tabular-nums">
                {currentServings}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setServingMultiplier(servingMultiplier + 0.5)}
                aria-label="Increase servings"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        <ul className="space-y-1.5" role="list">
          {items.map((item, index) => {
            const isChecked = checkedItems.has(index) || item.checked;
            const scaledAmount = scaleAmount(item.amount);

            return (
              <li key={index} className="flex items-start gap-2.5 text-sm">
                <button
                  type="button"
                  onClick={() => toggleItem(index)}
                  className={cn(
                    'shrink-0 mt-0.5 transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--category-accent)]/50 rounded'
                  )}
                  aria-label={isChecked ? `Uncheck ${item.name}` : `Check ${item.name}`}
                >
                  {isChecked ? (
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
                  )}
                </button>
                <div className={cn('flex-1', isChecked && 'line-through text-muted-foreground/50')}>
                  {scaledAmount && (
                    <span className="font-medium tabular-nums">{scaledAmount}</span>
                  )}
                  {scaledAmount && item.unit && ' '}
                  {item.unit && <span className="text-muted-foreground">{item.unit}</span>}
                  {(scaledAmount || item.unit) && ' '}
                  <span className="text-muted-foreground">{item.name}</span>
                  {item.notes && (
                    <span className="text-xs text-muted-foreground/70 ml-1">({item.notes})</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </BlockWrapper>
  );
});
