import type { VerdictOutput } from '@vie/types';
import { GlassCard } from '../GlassCard';
import { cn } from '../../../../lib/utils';

interface VerdictTabsProps {
  data: VerdictOutput;
  activeTab: string;
}

const BADGE_CONFIG: Record<string, { bg: string; label: string }> = {
  recommended: { bg: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30', label: 'Recommended' },
  not_recommended: { bg: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30', label: 'Not Recommended' },
  conditional: { bg: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30', label: 'Conditional' },
  best_in_class: { bg: 'bg-primary/10 text-primary border-primary/30', label: 'Best in Class' },
};

export function VerdictTabs({ data, activeTab }: VerdictTabsProps) {
  switch (activeTab) {
    case 'overview':
      return (
        <div className="flex flex-col gap-4">
          {/* Product & rating */}
          <GlassCard variant="elevated" className="text-center">
            <h3 className="text-lg font-bold">{data.product}</h3>
            {data.price && <p className="text-sm text-muted-foreground mt-1">{data.price}</p>}
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="text-4xl font-bold text-primary">{data.rating.score}</span>
              <span className="text-lg text-muted-foreground">/ {data.rating.maxScore}</span>
            </div>
            <p className="text-sm font-medium mt-1">{data.rating.label}</p>
          </GlassCard>
          {/* Badge */}
          {data.verdict && (
            <div className="flex justify-center">
              <span className={cn(
                'rounded-full border px-4 py-1.5 text-sm font-semibold',
                BADGE_CONFIG[data.verdict.badge]?.bg ?? '',
              )}>
                {BADGE_CONFIG[data.verdict.badge]?.label ?? data.verdict.badge}
              </span>
            </div>
          )}
        </div>
      );

    case 'pros_cons':
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Pros */}
          <GlassCard className="border-green-500/20">
            <h4 className="text-sm font-semibold text-green-600 dark:text-green-400 mb-3">Pros</h4>
            <ul className="flex flex-col gap-2">
              {data.pros.map((pro, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="shrink-0 text-green-500">{'\u2713'}</span>
                  <span>{pro}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
          {/* Cons */}
          <GlassCard className="border-red-500/20">
            <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3">Cons</h4>
            <ul className="flex flex-col gap-2">
              {data.cons.map((con, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="shrink-0 text-red-500">{'\u2717'}</span>
                  <span>{con}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>
      );

    case 'specs':
      return (
        <GlassCard>
          <h4 className="text-sm font-semibold mb-3">Specifications</h4>
          <div className="flex flex-col gap-0">
            {data.specs.map((spec, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center justify-between py-2 px-1 text-sm',
                  i < data.specs.length - 1 && 'border-b border-border/40',
                )}
              >
                <span className="text-muted-foreground">{spec.key}</span>
                <span className="font-medium">{spec.value}</span>
              </div>
            ))}
          </div>
          {/* Comparisons */}
          {data.comparisons.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-3">Comparisons</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40">
                      <th className="py-2 text-left text-xs text-muted-foreground font-medium">Feature</th>
                      <th className="py-2 text-left text-xs text-muted-foreground font-medium">{data.product}</th>
                      <th className="py-2 text-left text-xs text-muted-foreground font-medium">Competitor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.comparisons.map((comp, i) => (
                      <tr key={i} className="border-b border-border/20">
                        <td className="py-2 text-muted-foreground">{comp.feature}</td>
                        <td className="py-2">{comp.thisProduct}</td>
                        <td className="py-2">
                          {comp.competitorName !== data.comparisons[0]?.competitorName && (
                            <span className="text-xs text-muted-foreground mr-1">({comp.competitorName})</span>
                          )}
                          {comp.competitor}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </GlassCard>
      );

    case 'verdict':
      return (
        <GlassCard variant="elevated">
          <div className="flex flex-col gap-4">
            {/* Badge */}
            <div className="flex justify-center">
              <span className={cn(
                'rounded-full border px-6 py-2 text-lg font-bold',
                BADGE_CONFIG[data.verdict.badge]?.bg ?? '',
              )}>
                {BADGE_CONFIG[data.verdict.badge]?.label ?? data.verdict.badge}
              </span>
            </div>
            {/* Bottom line */}
            <p className="text-sm leading-relaxed text-center">{data.verdict.bottomLine}</p>
            {/* Best for / Not for */}
            <div className="grid gap-3 sm:grid-cols-2">
              {data.verdict.bestFor.length > 0 && (
                <div className="rounded-lg bg-green-500/5 p-3">
                  <h5 className="text-xs font-semibold text-green-600 dark:text-green-400 mb-2">Best For</h5>
                  <ul className="flex flex-col gap-1">
                    {data.verdict.bestFor.map((item, i) => (
                      <li key={i} className="text-sm flex gap-1.5">
                        <span className="text-green-500">{'\u2713'}</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.verdict.notFor.length > 0 && (
                <div className="rounded-lg bg-red-500/5 p-3">
                  <h5 className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">Not For</h5>
                  <ul className="flex flex-col gap-1">
                    {data.verdict.notFor.map((item, i) => (
                      <li key={i} className="text-sm flex gap-1.5">
                        <span className="text-red-500">{'\u2717'}</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      );

    default:
      return null;
  }
}
