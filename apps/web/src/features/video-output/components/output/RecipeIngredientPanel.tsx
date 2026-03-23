import { memo, useState, useCallback, useMemo, useEffect } from 'react';
import { Check, Square, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scaleAmount } from '@/features/video-output/components/output/lib/format-utils';
import { Button } from '@/components/ui/button';
import { useTabState } from '@/features/video-output/contexts/TabStateContext';

interface IngredientItem {
  label: string;
  note?: string;
  emoji?: string;
  amount?: number;
  displayAmount?: string;
  unit?: string;
  essential?: boolean;
  group?: string;
}

interface RecipeIngredientPanelProps {
  items: IngredientItem[];
  tabLabel: string;
  scalable?: boolean;
  baseServings?: number;
}

export const RecipeIngredientPanel = memo(function RecipeIngredientPanel({
  items,
  tabLabel,
  scalable,
  baseServings = 1,
}: RecipeIngredientPanelProps) {
  const tabState = useTabState();

  // Derive checked state from tabState (single source of truth).
  // isChecked callback is stable per checkedItems change, so tabState.isChecked
  // as dep causes re-derive when any check toggles.
  const checked = useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i < items.length; i++) {
      if (tabState.isChecked('checklist', i)) set.add(i);
    }
    return set;
  }, [items.length, tabState.isChecked]);
  const [servings, setServings] = useState(baseServings);

  // Sync servings when baseServings prop changes (e.g. parent re-renders with new data)
  useEffect(() => { setServings(baseServings); }, [baseServings]);

  const multiplier = baseServings > 0 ? servings / baseServings : 1;

  const toggle = useCallback((index: number) => {
    if (tabState.isChecked('checklist', index)) {
      tabState.uncheckItem('checklist', index);
    } else {
      tabState.checkItem('checklist', index);
    }
  }, [tabState]);

  const progress = useMemo(
    () => (items.length > 0 ? Math.round((checked.size / items.length) * 100) : 0),
    [checked.size, items.length],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
        <span className="text-xs font-medium text-muted-foreground">{tabLabel}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{progress}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-muted/30">
        <div
          className="h-full bg-[var(--vie-accent)] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Servings scaler */}
      {scalable && (
        <div className="flex items-center justify-center gap-2 py-2 border-b border-border/30">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setServings(s => Math.max(1, s - 1))}
            disabled={servings <= 1}
            aria-label="Decrease servings"
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="text-xs font-medium tabular-nums min-w-[60px] text-center">
            {servings} serving{servings !== 1 ? 's' : ''}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setServings(s => s + 1)}
            aria-label="Increase servings"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Item list — scrollable */}
      <ul className="flex-1 overflow-y-auto p-2 space-y-0.5" role="list">
        {items.map((item, index) => {
          const isChecked = checked.has(index);
          const displayLabel = scalable && item.amount
            ? `${scaleAmount(item.amount, multiplier)}${item.unit ? ` ${item.unit}` : ''} ${item.label}`
            : item.displayAmount
              ? `${item.displayAmount} ${item.label}`
              : item.label;

          return (
            <li key={index}>
              <button
                type="button"
                onClick={() => toggle(index)}
                className={cn(
                  'w-full flex items-start gap-2 rounded-md px-2 py-1.5 text-left',
                  'transition-all duration-150 active:scale-[0.98]',
                  'hover:bg-muted/30 min-h-[44px]',
                  isChecked && 'opacity-50',
                )}
                aria-pressed={isChecked}
              >
                <span className="mt-0.5 shrink-0 text-[var(--vie-accent)]" aria-hidden="true">
                  {isChecked ? <Check className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                </span>
                <span className={cn('text-xs', isChecked && 'line-through')}>
                  {item.emoji && <span className="mr-1" aria-hidden="true">{item.emoji}</span>}
                  {displayLabel}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
});
