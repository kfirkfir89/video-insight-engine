import { memo, useCallback, useMemo, useState } from 'react';
import { Check, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard } from '../GlassCard';
import { Celebration } from '../Celebration';
import { CrossTabLink } from '../CrossTabLink';

interface ChecklistItem {
  label: string;
  note?: string;
  emoji?: string;
}

interface ChecklistInteractiveProps {
  items: ChecklistItem[];
  tabLabel: string;
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

export const ChecklistInteractive = memo(function ChecklistInteractive({
  items,
  tabLabel,
  nextTab,
  onNavigateTab,
}: ChecklistInteractiveProps) {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const toggle = useCallback((index: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const progress = useMemo(
    () => (items.length > 0 ? Math.round((checked.size / items.length) * 100) : 0),
    [checked.size, items.length],
  );

  const allChecked = items.length > 0 && checked.size === items.length;

  if (items.length === 0) return null;

  return (
    <GlassCard className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{tabLabel}</span>
          <span className="tabular-nums">{progress}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted/30 overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--vie-accent)] transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Items */}
      <ul className="space-y-1" role="list">
        {items.map((item, index) => {
          const isChecked = checked.has(index);
          return (
            <li key={index}>
              <button
                type="button"
                onClick={() => toggle(index)}
                className={cn(
                  'w-full flex items-start gap-3 rounded-lg px-3 py-2.5 text-left',
                  'transition-all duration-150 active:scale-[0.98]',
                  'hover:bg-muted/30',
                  isChecked && 'opacity-60',
                )}
                aria-pressed={isChecked}
              >
                <span className="mt-0.5 shrink-0 text-[var(--vie-accent)]" aria-hidden="true">
                  {isChecked ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <span
                    className={cn(
                      'text-sm font-medium',
                      isChecked && 'line-through',
                    )}
                  >
                    {item.emoji && (
                      <span className="mr-1.5" aria-hidden="true">{item.emoji}</span>
                    )}
                    {item.label}
                  </span>
                  {item.note && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.note}</p>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Celebration */}
      {allChecked && (
        <Celebration
          emoji="🎉"
          title="All done!"
          subtitle={`You completed all ${items.length} items`}
          nextTabId={nextTab}
          nextLabel={nextTab ? 'Continue' : undefined}
          onNavigateTab={onNavigateTab}
        />
      )}

      {/* Cross-tab link */}
      {!allChecked && nextTab && onNavigateTab && (
        <CrossTabLink tabId={nextTab} label="Continue" onNavigate={onNavigateTab} />
      )}
    </GlassCard>
  );
});
