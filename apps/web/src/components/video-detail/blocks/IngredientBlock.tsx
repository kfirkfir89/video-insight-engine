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
      variant="card"
      headerIcon={<UtensilsCrossed className="h-4 w-4" />}
      headerLabel={BLOCK_LABELS.ingredients}
      headerAction={
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
      }
    >
      <div className="space-y-0">
        <ul className="space-y-0 stagger-children" role="list">
          {items.map((item, index) => {
            const isChecked = checkedItems.has(index) || item.checked;
            const scaledAmount = scaleAmount(item.amount);

            return (
              <li key={index}>
                <div className="flex items-start gap-2.5 text-sm py-1.5">
                  <Button
                    variant="ghost"
                    size="icon-bare"
                    onClick={() => toggleItem(index)}
                    className="shrink-0 mt-0.5 transition-colors"
                    aria-label={isChecked ? `Uncheck ${item.name}` : `Check ${item.name}`}
                  >
                    {isChecked ? (
                      <Check className="h-4 w-4 text-success" aria-hidden="true" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
                    )}
                  </Button>
                  <div className={cn('flex-1', isChecked && 'line-through text-muted-foreground/50')}>
                    {scaledAmount && (
                      <span className="font-mono text-xs font-bold bg-muted/20 px-1.5 py-0.5 rounded tabular-nums amount-badge-glow">{scaledAmount}</span>
                    )}
                    {scaledAmount && item.unit && ' '}
                    {item.unit && <span className="text-muted-foreground">{item.unit}</span>}
                    {(scaledAmount || item.unit) && ' '}
                    <span className="text-muted-foreground">{item.name}</span>
                    {item.notes && (
                      <span className="text-xs text-muted-foreground/70 ml-1">({item.notes})</span>
                    )}
                  </div>
                </div>
                {index < items.length - 1 && (
                  <div className="fade-divider" aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </BlockWrapper>
  );
});
