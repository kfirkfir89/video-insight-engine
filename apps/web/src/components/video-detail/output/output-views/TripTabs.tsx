import { useState } from 'react';
import type { TripPlannerOutput } from '@vie/types';
import { GlassCard } from '../GlassCard';
import { cn } from '../../../../lib/utils';

interface TripTabsProps {
  data: TripPlannerOutput;
  activeTab: string;
}

export function TripTabs({ data, activeTab }: TripTabsProps) {
  switch (activeTab) {
    case 'trip':
      return <DayCards days={data.days} />;

    case 'budget':
      return (
        <div className="flex flex-col gap-4">
          {/* Total */}
          <GlassCard variant="elevated" className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Estimated Total</p>
            <p className="text-3xl font-bold mt-1">
              {data.budget.currency} {data.budget.total.toLocaleString()}
            </p>
          </GlassCard>
          {/* Breakdown */}
          <div className="flex flex-col gap-2">
            {data.budget.breakdown.map((item, i) => (
              <GlassCard key={i} className="flex items-center justify-between py-3 px-4">
                <div>
                  <p className="text-sm font-medium">{item.category}</p>
                  {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                </div>
                <span className="text-sm font-semibold">
                  {item.currency} {item.amount.toLocaleString()}
                </span>
              </GlassCard>
            ))}
          </div>
        </div>
      );

    case 'pack':
      return <PackingChecklist items={data.packingList} />;

    default:
      return null;
  }
}

/** Day-by-day itinerary cards */
function DayCards({ days }: { days: TripPlannerOutput['days'] }) {
  return (
    <div className="flex flex-col gap-4">
      {days.map((day) => (
        <GlassCard key={day.day}>
          <div className="flex items-center gap-3 mb-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {day.day}
            </span>
            <div>
              <h4 className="text-sm font-semibold">
                {day.city ? `Day ${day.day} - ${day.city}` : `Day ${day.day}`}
              </h4>
              {day.theme && <p className="text-xs text-muted-foreground">{day.theme}</p>}
            </div>
            {day.dailyCost && (
              <span className="ml-auto text-xs font-medium text-muted-foreground">{day.dailyCost}</span>
            )}
          </div>
          <div className="flex flex-col gap-2 ml-11">
            {day.spots.map((spot, i) => (
              <div key={i} className="rounded-lg bg-muted/30 p-3">
                <div className="flex items-start gap-2">
                  <span className="text-lg">{spot.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-sm font-medium">{spot.name}</h5>
                    <p className="text-xs text-muted-foreground mt-0.5">{spot.description}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {spot.cost && <span className="text-xs text-primary">{spot.cost}</span>}
                      {spot.duration && <span className="text-xs text-muted-foreground">{spot.duration}</span>}
                    </div>
                    {spot.tips && <p className="text-xs text-muted-foreground/80 italic mt-1">{spot.tips}</p>}
                  </div>
                </div>
              </div>
            ))}
            {day.tips.length > 0 && (
              <div className="mt-1">
                {day.tips.map((tip, i) => (
                  <p key={i} className="text-xs text-muted-foreground italic">{tip}</p>
                ))}
              </div>
            )}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

/** Packing checklist with category grouping */
function PackingChecklist({ items }: { items: TripPlannerOutput['packingList'] }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // Group by category
  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const cat = item.category || 'Other';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(item);
  }

  function toggleItem(itemName: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(itemName)) next.delete(itemName);
      else next.add(itemName);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {Array.from(groups.entries()).map(([category, catItems]) => (
        <GlassCard key={category}>
          <h4 className="text-sm font-semibold mb-3">{category}</h4>
          <ul className="flex flex-col gap-2">
            {catItems.map((item, i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checked.has(item.item)}
                  onChange={() => toggleItem(item.item)}
                  className="h-4 w-4 rounded border-muted-foreground/30 accent-primary"
                  aria-label={item.item}
                />
                <span className={cn(
                  'text-sm',
                  checked.has(item.item) && 'line-through text-muted-foreground',
                )}>
                  {item.item}
                </span>
                {item.essential && (
                  <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-600 dark:text-red-400">
                    Essential
                  </span>
                )}
              </li>
            ))}
          </ul>
        </GlassCard>
      ))}
    </div>
  );
}
