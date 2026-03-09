import { memo, useState } from 'react';
import { LayoutList, UtensilsCrossed, Check, Square, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BlockWrapper } from './BlockWrapper';
import type { ToolListBlock, IngredientBlock } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface ChecklistBlockProps {
  block: ToolListBlock | IngredientBlock;
}

/**
 * Unified checklist block — renders tool lists or ingredient lists.
 * Merges ToolListBlock + IngredientBlock into one component with shared checkbox logic.
 */
export const ChecklistBlock = memo(function ChecklistBlock({ block }: ChecklistBlockProps) {
  if (block.type === 'ingredient') {
    return <IngredientList block={block} />;
  }
  return <ToolList block={block} />;
});

// ── Shared checkbox toggle hook ──

function useCheckedSet() {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const toggle = (index: number) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };
  return { checked, toggle };
}

// ── Tool List ──

function ToolList({ block }: { block: ToolListBlock }) {
  const tools = block.tools ?? [];
  const { checked, toggle } = useCheckedSet();

  if (tools.length === 0) return null;

  return (
    <BlockWrapper blockId={block.blockId} label={BLOCK_LABELS.tools} variant="inline">
      <div className="space-y-2">
        <div className="block-label-minimal">
          <LayoutList className="h-3 w-3" aria-hidden="true" />
          <span>{BLOCK_LABELS.tools}</span>
        </div>
        <ul className="space-y-0 stagger-children" role="list">
          {tools.map((tool, index) => {
            const isChecked = checked.has(index) || tool.checked;
            return (
              <li key={index}>
                {index > 0 && <div className="fade-divider my-1" aria-hidden="true" />}
                <div className={cn('flex items-start gap-2.5 text-sm py-2 transition-colors', isChecked && 'opacity-60')}>
                  <Button
                    variant="ghost"
                    size="icon-bare"
                    onClick={() => toggle(index)}
                    className="shrink-0 mt-0.5 transition-colors"
                    aria-label={isChecked ? `Uncheck ${tool.name}` : `Check ${tool.name}`}
                  >
                    {isChecked ? (
                      <Check className="h-4 w-4 text-success dark:drop-shadow-[0_0_4px_currentColor]" aria-hidden="true" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
                    )}
                  </Button>
                  <div className={cn('flex-1', isChecked && 'line-through text-muted-foreground/50')}>
                    <span className="font-medium">{tool.name}</span>
                    {tool.quantity && <span className="text-muted-foreground"> — {tool.quantity}</span>}
                    {tool.notes && (
                      <span className="text-xs text-muted-foreground/70 ml-1">({tool.notes})</span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </BlockWrapper>
  );
}

// ── Ingredient List ──

function IngredientList({ block }: { block: IngredientBlock }) {
  const items = block.items ?? [];
  const baseServings = block.servings ?? 4;
  const { checked, toggle } = useCheckedSet();
  const [servingMultiplier, setServingMultiplier] = useState(1);

  if (items.length === 0) return null;

  const currentServings = baseServings * servingMultiplier;

  const scaleAmount = (amount: string | undefined): string | undefined => {
    if (!amount) return undefined;
    const match = amount.match(/^([\d./]+)\s*(.*)$/);
    if (match) {
      const [, numPart, rest] = match;
      let value: number;
      if (numPart.includes('/')) {
        const [num, denom] = numPart.split('/');
        value = Number(num) / Number(denom);
      } else {
        value = Number(numPart);
      }
      if (!isNaN(value)) {
        const scaled = value * servingMultiplier;
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
            <span className="text-sm font-medium w-8 text-center tabular-nums">{currentServings}</span>
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
            const isChecked = checked.has(index) || item.checked;
            const scaledAmount = scaleAmount(item.amount);
            return (
              <li key={index}>
                <div className="flex items-start gap-2.5 text-sm py-1.5">
                  <Button
                    variant="ghost"
                    size="icon-bare"
                    onClick={() => toggle(index)}
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
}
