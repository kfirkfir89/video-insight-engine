import { memo, useState, useMemo } from 'react';
import { Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard, FadeIn, Badge, ScoreRing } from '@/components/vie';

import { useLabels } from '@/lib/i18n';

import type { ReviewComparison } from '@vie/types';

type ComparisonMode = 'table' | 'pros_cons' | 'versus';

interface ComparisonRow extends ReviewComparison {
  winner?: 'left' | 'right' | 'tie';
}

interface ComparisonInteractiveProps {
  comparisons?: ComparisonRow[];
  pros?: string[];
  cons?: string[];
  type?: ComparisonMode;
  leftLabel?: string;
  rightLabel?: string;
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

export const ComparisonInteractive = memo(function ComparisonInteractive({
  comparisons = [],
  pros,
  cons,
  type = 'table',
  leftLabel,
  rightLabel,
  nextTab: _nextTab,
  onNavigateTab: _onNavigateTab,
}: ComparisonInteractiveProps) {
  const t = useLabels();
  const [activeRow, setActiveRow] = useState(0);
  const [prosExpanded, setProsExpanded] = useState(true);
  const [consExpanded, setConsExpanded] = useState(true);

  const hasComparisons = comparisons.length > 0;
  const hasPros = pros && pros.length > 0;
  const hasCons = cons && cons.length > 0;
  const competitorName = hasComparisons ? comparisons[0].competitorName : '';
  const isReview = Boolean(competitorName);
  const colLeft = leftLabel || (isReview ? 'This Product' : t.description);
  const colRight = rightLabel || competitorName || (isReview ? 'Competitor' : t.example);

  // Verdict summary from winner fields
  const verdictSummary = useMemo(() => {
    const withWinner = comparisons.filter((c) => c.winner);
    if (withWinner.length === 0) return null;
    const leftWins = withWinner.filter((c) => c.winner === 'left').length;
    const rightWins = withWinner.filter((c) => c.winner === 'right').length;
    const ties = withWinner.filter((c) => c.winner === 'tie').length;
    return { leftWins, rightWins, ties, total: withWinner.length };
  }, [comparisons]);

  if (!hasComparisons && !hasPros && !hasCons) return null;

  return (
    <div className="space-y-4">
      {/* Feature comparison — table mode */}
      {hasComparisons && type === 'table' && (
        <GlassCard variant="default" className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2.5">Feature</th>
                  <th className="text-start text-xs font-semibold uppercase tracking-wider text-primary px-4 py-2.5">{colLeft}</th>
                  <th className="text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2.5">{colRight}</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((item, index) => {
                  const isLeftWinner = item.winner === 'left';
                  const isRightWinner = item.winner === 'right';
                  return (
                    <tr
                      key={index}
                      className={cn(
                        'border-b border-border/30 cursor-pointer transition-colors',
                        index === activeRow ? 'bg-primary/5' : 'hover:bg-muted/30',
                      )}
                      onClick={() => setActiveRow(index)}
                    >
                      <td className="px-4 py-2.5 text-sm font-semibold leading-snug">
                        {item.feature}
                        {item.winner === 'tie' && (
                          <Badge variant="muted" className="ms-2 text-xs font-medium">Tie</Badge>
                        )}
                      </td>
                      <td className={cn(
                        'px-4 py-2.5 text-sm leading-relaxed',
                        isLeftWinner ? 'text-success font-semibold' : 'text-muted-foreground',
                      )}>
                        {item.thisProduct}
                        {isLeftWinner && <Check className="inline h-3.5 w-3.5 ms-1 text-success" aria-hidden="true" />}
                      </td>
                      <td className={cn(
                        'px-4 py-2.5 text-sm leading-relaxed',
                        isRightWinner ? 'text-success font-semibold' : 'text-muted-foreground',
                      )}>
                        {item.competitor}
                        {isRightWinner && <Check className="inline h-3.5 w-3.5 ms-1 text-success" aria-hidden="true" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Versus mode */}
      {hasComparisons && type === 'versus' && (
        <div className="space-y-2">
          {comparisons.map((item, index) => (
            <FadeIn key={index} index={index}>
              <GlassCard variant="outlined" className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{item.feature}</p>
                  {item.winner && item.winner !== 'tie' && (
                    <Badge variant="success" className="text-xs font-semibold">
                      {item.winner === 'left' ? colLeft : colRight} wins
                    </Badge>
                  )}
                  {item.winner === 'tie' && <Badge variant="muted" className="text-xs font-medium">Tie</Badge>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  <div className={cn(
                    'rounded-md p-2 relative',
                    item.winner === 'left' ? 'bg-success/10 border border-success/20' : 'bg-muted/20',
                    item.winner === 'right' && 'opacity-60',
                  )}>
                    {item.winner === 'left' && (
                      <span className="absolute -top-2 -end-1 text-sm" aria-label="Winner">{'🏆'}</span>
                    )}
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">{colLeft}</span>
                    <p className="text-sm leading-relaxed text-muted-foreground mt-1">{item.thisProduct}</p>
                  </div>
                  <div className={cn(
                    'rounded-md p-2 relative',
                    item.winner === 'right' ? 'bg-success/10 border border-success/20' : 'bg-muted/20',
                    item.winner === 'left' && 'opacity-60',
                  )}>
                    {item.winner === 'right' && (
                      <span className="absolute -top-2 -end-1 text-sm" aria-label="Winner">{'🏆'}</span>
                    )}
                    <span className="text-xs font-semibold uppercase tracking-wider">{colRight}</span>
                    <p className="text-sm leading-relaxed text-muted-foreground mt-1">{item.competitor}</p>
                  </div>
                </div>
              </GlassCard>
            </FadeIn>
          ))}
        </div>
      )}

      {/* Verdict summary card */}
      {verdictSummary && (
        <FadeIn>
          <GlassCard variant="accent" className="flex items-center gap-4">
            <ScoreRing
              score={verdictSummary.leftWins}
              total={verdictSummary.total}
              label={colLeft}
              size="sm"
            />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-semibold leading-snug">
                {colLeft} wins <span className="tabular-nums">{verdictSummary.leftWins}</span> of <span className="tabular-nums">{verdictSummary.total}</span> categories
              </p>
              {verdictSummary.ties > 0 && (
                <p className="text-xs font-medium text-muted-foreground">
                  <span className="tabular-nums">{verdictSummary.ties}</span> {verdictSummary.ties === 1 ? 'tie' : 'ties'}
                </p>
              )}
            </div>
          </GlassCard>
        </FadeIn>
      )}

      {/* Go for it / Skip it recommendation cards */}
      {(hasPros || hasCons) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {hasPros && (
            <FadeIn>
              <GlassCard variant="outlined" className="space-y-2">
                <button
                  onClick={() => setProsExpanded((p) => !p)}
                  className="w-full flex items-center justify-between"
                >
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-success flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    {t.goForIt}
                    <Badge variant="success" className="text-xs font-semibold tabular-nums">{pros.length}</Badge>
                  </h4>
                  {prosExpanded
                    ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                    : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  }
                </button>
                {prosExpanded && (
                  <ul className="space-y-1.5">
                    {pros.map((pro, i) => (
                      <li key={i} className="flex items-baseline gap-2 text-sm leading-relaxed text-muted-foreground">
                        <span className="w-1 h-1 rounded-full bg-success/70 shrink-0 translate-y-1.5" />
                        {pro}
                      </li>
                    ))}
                  </ul>
                )}
              </GlassCard>
            </FadeIn>
          )}
          {hasCons && (
            <FadeIn>
              <GlassCard variant="outlined" className="space-y-2">
                <button
                  onClick={() => setConsExpanded((p) => !p)}
                  className="w-full flex items-center justify-between"
                >
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-destructive flex items-center gap-1.5">
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    Skip it if...
                    <Badge variant="destructive" className="text-xs font-semibold tabular-nums">{cons.length}</Badge>
                  </h4>
                  {consExpanded
                    ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                    : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  }
                </button>
                {consExpanded && (
                  <ul className="space-y-1.5">
                    {cons.map((con, i) => (
                      <li key={i} className="flex items-baseline gap-2 text-sm leading-relaxed text-muted-foreground">
                        <span className="w-1 h-1 rounded-full bg-destructive/70 shrink-0 translate-y-1.5" />
                        {con}
                      </li>
                    ))}
                  </ul>
                )}
              </GlassCard>
            </FadeIn>
          )}
        </div>
      )}

    </div>
  );
});
