import { Check, X } from 'lucide-react';
import { GlassCard, FadeIn, Badge, ScoreRing } from '@/components/vie';

import { useLabels } from '@/lib/i18n';

interface SubScore {
  category: string;
  score: number;
}

export interface VerdictData {
  badge?: string;
  bottomLine?: string;
  bestFor?: string[];
  notFor?: string[];
  score?: number;
  maxScore?: number;
  subScores?: SubScore[];
}

const BADGE_COLORS: Record<string, 'success' | 'warning' | 'destructive' | 'info'> = {
  recommended: 'success',
  best_in_class: 'success',
  conditional: 'warning',
  not_recommended: 'destructive',
};

interface ReviewSummaryProps {
  verdict: VerdictData;
}

/**
 * Top-of-tab verdict header — Frame-as-Hero summary card combining badge, score,
 * bottom-line sentence, best-for / not-for lists, and an optional sub-score
 * scroller. Mirrors the layout the old VerdictInteractive used so legacy
 * `verdict` tabs keep their character after consolidation into Comparison.
 * Returns null when no bottomLine is provided, so callers can drop it unguarded.
 */
export function ReviewSummary({ verdict }: ReviewSummaryProps) {
  const t = useLabels();
  const { badge, bottomLine, bestFor, notFor, score, maxScore = 10, subScores } = verdict;
  if (!bottomLine) return null;

  const hasScore = typeof score === 'number';
  const hasBestFor = Boolean(bestFor && bestFor.length > 0);
  const hasNotFor = Boolean(notFor && notFor.length > 0);
  const hasSubScores = Boolean(subScores && subScores.length > 0);
  const badgeVariant = badge ? BADGE_COLORS[badge] ?? 'muted' : undefined;

  return (
    <FadeIn>
      <div className="space-y-3">
        <GlassCard variant="accent" className="space-y-3">
          <div className="flex items-start gap-4">
            {hasScore && (
              <ScoreRing score={score!} total={maxScore} label={t.score} size="md" />
            )}
            <div className="flex-1 min-w-0 space-y-2">
              {badge && (
                <Badge
                  variant={badgeVariant ?? 'muted'}
                  className="text-xs font-semibold uppercase tracking-wider"
                >
                  {badge.replace(/_/g, ' ')}
                </Badge>
              )}
              <p className="text-sm font-semibold leading-relaxed">{bottomLine}</p>
            </div>
          </div>

          {hasSubScores && (
            <div className="overflow-x-auto">
              <div className="flex gap-4 pb-1 min-w-max px-1">
                {subScores!.map((sub, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <ScoreRing score={sub.score} total={maxScore} size="sm" />
                    <span className="text-xs font-medium text-muted-foreground text-center max-w-[72px] truncate">
                      {sub.category}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassCard>

        {(hasBestFor || hasNotFor) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {hasBestFor && (
              <GlassCard variant="outlined" className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-success flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Best For
                  <Badge variant="success" className="text-xs font-semibold tabular-nums">
                    {bestFor!.length}
                  </Badge>
                </h4>
                <ul className="space-y-1.5">
                  {bestFor!.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-baseline gap-2 text-sm leading-relaxed text-muted-foreground"
                    >
                      <span className="w-1 h-1 rounded-full bg-success/70 shrink-0 translate-y-1.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </GlassCard>
            )}
            {hasNotFor && (
              <GlassCard variant="outlined" className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-destructive flex items-center gap-1.5">
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Not For
                  <Badge variant="destructive" className="text-xs font-semibold tabular-nums">
                    {notFor!.length}
                  </Badge>
                </h4>
                <ul className="space-y-1.5">
                  {notFor!.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-baseline gap-2 text-sm leading-relaxed text-muted-foreground"
                    >
                      <span className="w-1 h-1 rounded-full bg-destructive/70 shrink-0 translate-y-1.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </GlassCard>
            )}
          </div>
        )}
      </div>
    </FadeIn>
  );
}
