import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { FlowContextItem } from './flow-modes';

interface FlowContextPanelProps {
  items: FlowContextItem[];
  label: string;
}

/**
 * Read-only context panel for FlowPlayer modes that aren't cooking. Mirrors the
 * visual language of RecipeIngredientPanel (header + scrollable list) but
 * without the check-off / serving-scaler behavior, which is cooking-specific.
 * Items are grouped under their `group` heading when present so warmup/cooldown,
 * packing/budget, or materials/code stay visually separated.
 */
export const FlowContextPanel = memo(function FlowContextPanel({ items, label }: FlowContextPanelProps) {
  const groups = useMemo(() => {
    const map = new Map<string, FlowContextItem[]>();
    for (const item of items) {
      const key = item.group ?? '';
      const bucket = map.get(key);
      if (bucket) bucket.push(item);
      else map.set(key, [item]);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {groups.map(([group, groupItems], gi) => (
          <div key={group || `g-${gi}`} className="space-y-0.5">
            {group && (
              <p className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </p>
            )}
            <ul role="list" className="space-y-0.5">
              {groupItems.map((item, index) => (
                <li
                  key={`${group}-${index}`}
                  className={cn(
                    'flex items-start gap-2 rounded-md px-2 py-1.5 text-start',
                    'hover:bg-muted/30',
                  )}
                >
                  {item.emoji && (
                    <span className="mt-0.5 shrink-0" aria-hidden="true">{item.emoji}</span>
                  )}
                  <span className="text-xs">
                    <span className="font-medium">{item.label}</span>
                    {item.note && (
                      <span className="block text-muted-foreground">{item.note}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
});
