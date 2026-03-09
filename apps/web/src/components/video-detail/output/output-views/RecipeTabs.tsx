import type { RecipeOutput } from '@vie/types';
import { GlassCard } from '../GlassCard';

interface RecipeTabsProps {
  data: RecipeOutput;
  activeTab: string;
}

function formatTime(minutes?: number): string {
  if (!minutes) return '--';
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function RecipeTabs({ data, activeTab }: RecipeTabsProps) {
  switch (activeTab) {
    case 'overview':
      return (
        <div className="flex flex-col gap-4">
          {/* Meta stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.meta.prepTime !== undefined && (
              <GlassCard className="text-center py-3">
                <p className="text-xs text-muted-foreground">Prep</p>
                <p className="text-lg font-bold">{formatTime(data.meta.prepTime)}</p>
              </GlassCard>
            )}
            {data.meta.cookTime !== undefined && (
              <GlassCard className="text-center py-3">
                <p className="text-xs text-muted-foreground">Cook</p>
                <p className="text-lg font-bold">{formatTime(data.meta.cookTime)}</p>
              </GlassCard>
            )}
            {data.meta.servings !== undefined && (
              <GlassCard className="text-center py-3">
                <p className="text-xs text-muted-foreground">Servings</p>
                <p className="text-lg font-bold">{data.meta.servings}</p>
              </GlassCard>
            )}
            {data.meta.difficulty && (
              <GlassCard className="text-center py-3">
                <p className="text-xs text-muted-foreground">Difficulty</p>
                <p className="text-lg font-bold capitalize">{data.meta.difficulty}</p>
              </GlassCard>
            )}
          </div>
          {data.meta.cuisine && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Cuisine:</span> {data.meta.cuisine}
            </p>
          )}
          {data.equipment.length > 0 && (
            <GlassCard>
              <h4 className="text-sm font-semibold mb-2">Equipment Needed</h4>
              <div className="flex flex-wrap gap-2">
                {data.equipment.map((eq, i) => (
                  <span key={i} className="rounded-full bg-muted px-3 py-1 text-xs">{eq}</span>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      );

    case 'ingredients': {
      // Group ingredients by group if available
      const groups = new Map<string, typeof data.ingredients>();
      for (const ing of data.ingredients) {
        const group = ing.group ?? 'Ingredients';
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group)!.push(ing);
      }

      return (
        <div className="flex flex-col gap-4">
          {Array.from(groups.entries()).map(([group, items]) => (
            <GlassCard key={group}>
              <h4 className="text-sm font-semibold mb-3">{group}</h4>
              <ul className="flex flex-col gap-2">
                {items.map((ing, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-muted-foreground/30 accent-primary"
                      aria-label={ing.name}
                    />
                    <span>
                      {ing.amount && <span className="font-medium">{ing.amount} </span>}
                      {ing.unit && <span className="text-muted-foreground">{ing.unit} </span>}
                      {ing.name}
                      {ing.notes && <span className="text-muted-foreground italic"> ({ing.notes})</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          ))}
        </div>
      );
    }

    case 'steps':
      return (
        <div className="flex flex-col gap-3">
          {data.steps.map((step) => (
            <GlassCard key={step.number} variant="interactive">
              <div className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {step.number}
                </span>
                <div className="flex flex-col gap-1 min-w-0">
                  <p className="text-sm leading-relaxed">{step.instruction}</p>
                  {step.duration && (
                    <span className="text-xs text-muted-foreground">{formatTime(step.duration)}</span>
                  )}
                  {step.tips && (
                    <p className="mt-1 text-xs text-primary/80 italic">{step.tips}</p>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      );

    case 'tips':
      return (
        <div className="flex flex-col gap-3">
          {data.tips.map((tip, i) => {
            const typeStyles: Record<string, { bg: string; label: string }> = {
              chef_tip: { bg: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400', label: 'Chef Tip' },
              warning: { bg: 'bg-red-500/10 text-red-700 dark:text-red-400', label: 'Warning' },
              substitution: { bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-400', label: 'Substitution' },
              storage: { bg: 'bg-green-500/10 text-green-700 dark:text-green-400', label: 'Storage' },
            };
            const style = typeStyles[tip.type] ?? typeStyles.chef_tip;
            return (
              <GlassCard key={i}>
                <div className="flex flex-col gap-1">
                  <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium ${style.bg}`}>
                    {style.label}
                  </span>
                  <p className="text-sm leading-relaxed">{tip.text}</p>
                </div>
              </GlassCard>
            );
          })}
          {data.substitutions.length > 0 && (
            <GlassCard>
              <h4 className="text-sm font-semibold mb-3">Substitutions</h4>
              <div className="flex flex-col gap-2">
                {data.substitutions.map((sub, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{sub.original}</span>
                    <span className="text-muted-foreground">{'\u2192'}</span>
                    <span>{sub.substitute}</span>
                    {sub.notes && <span className="text-xs text-muted-foreground">({sub.notes})</span>}
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      );

    default:
      return null;
  }
}
