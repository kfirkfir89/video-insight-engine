import { memo, useState, useMemo, useEffect, useRef } from 'react';
import { Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from 'recharts';
import { cn } from '@/lib/utils';
import { GlassCard, FadeIn, Badge, ScoreRing, EmojiMarker } from '@/components/vie';
import { Slider } from '@/components/ui/slider';
import { useMediaQuery } from '@/hooks/use-media-query';

import { useLabels } from '@/lib/i18n';

import type { ReviewComparison } from '@vie/types';

type ComparisonMode = 'table' | 'pros_cons' | 'versus';

// ─── Radar scoring (merged from the retired ComparisonRadar) ───

const RADAR_MIN_AXES = 3;
const DEFAULT_WEIGHT = 5;
const MAX_SCORE = 10;

interface AxisScore {
  feature: string;
  left: number;
  right: number;
  /** Whether scores came from numeric extraction (vs winner-based fallback). */
  isNumeric: boolean;
}

function parseNumeric(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

/**
 * Normalises a comparison row to a pair of 0–10 scores per side. Numeric
 * sides scale so the larger is 10; otherwise winner-based fallback
 * (left=8/right=5 or flipped, tie=6/6). Exported for unit testing.
 */
export function scoreComparisonAxes(comparisons: ReviewComparison[]): AxisScore[] {
  return comparisons.map((row) => {
    const left = parseNumeric(row.thisProduct);
    const right = parseNumeric(row.competitor);
    if (left != null && right != null) {
      const max = Math.max(Math.abs(left), Math.abs(right), 1);
      return {
        feature: row.feature,
        left: clamp01(left / max) * MAX_SCORE,
        right: clamp01(right / max) * MAX_SCORE,
        isNumeric: true,
      };
    }
    if (row.winner === 'left') return { feature: row.feature, left: 8, right: 5, isNumeric: false };
    if (row.winner === 'right') return { feature: row.feature, left: 5, right: 8, isNumeric: false };
    return { feature: row.feature, left: 6, right: 6, isNumeric: false };
  });
}

function computeLeftPercent(scores: AxisScore[], weights: number[]): number {
  const leftTotal = scores.reduce((acc, s, i) => acc + s.left * (weights[i] ?? DEFAULT_WEIGHT), 0);
  const rightTotal = scores.reduce((acc, s, i) => acc + s.right * (weights[i] ?? DEFAULT_WEIGHT), 0);
  const sum = leftTotal + rightTotal;
  if (sum <= 0) return 50;
  return Math.round((leftTotal / sum) * 100);
}

interface ComparisonRadarHeroProps {
  comparisons: ReviewComparison[];
  colLeft: string;
  colRight: string;
}

/**
 * Radar hero — one axis per comparison row, two series, per-axis weight
 * sliders to re-balance the weighted winner. Rendered above the table when a
 * comparison has ≥3 scoreable axes. Merged in from the retired standalone
 * ComparisonRadar; the unified component now chooses radar-vs-table by data.
 */
const ComparisonRadarHero = memo(function ComparisonRadarHero({
  comparisons,
  colLeft,
  colRight,
}: ComparisonRadarHeroProps) {
  const scored = useMemo(() => scoreComparisonAxes(comparisons), [comparisons]);
  const [weights, setWeights] = useState<number[]>(() => comparisons.map(() => DEFAULT_WEIGHT));
  const [tunerOpen, setTunerOpen] = useState(false);

  // Self-measure the chart box rather than leaning on Recharts'
  // ResponsiveContainer, which latches a 0×0 reading when it mounts inside a
  // hidden (display:none) tab and never recovers on reveal — the radar then
  // renders as a ~14px stub. A ResizeObserver fires correctly when the element
  // first gains size, so we hand RadarChart explicit pixel dimensions.
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    // Floor out implausibly-narrow readings (~14px) that Recharts/ResizeObserver
    // can deliver mid-layout and latch forever. A real radar card is always far
    // wider than this, so the floor rejects only the glitch — legitimate small
    // viewports (and shrinks from a larger size) still pass through.
    const MIN_CHART_WIDTH = 100;
    const measure = (width: number, height: number) => {
      if (width >= MIN_CHART_WIDTH && height > 0) {
        setChartSize({ width, height });
      }
    };
    // Synchronous read first: an already-laid-out container is sized now,
    // so we don't depend on the observer's first async callback.
    const initial = el.getBoundingClientRect();
    measure(initial.width, initial.height);
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) measure(rect.width, rect.height);
    });
    observer.observe(el);
    // Backstop: if the container mounts tiny (mid tab-transition) the observer
    // can miss the settle. Re-read after the browser has laid out for real.
    const raf1 = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      measure(r.width, r.height);
    });
    return () => {
      cancelAnimationFrame(raf1);
      observer.disconnect();
    };
  }, []);

  // Re-sync weight array length whenever the comparison count changes.
  useMemo(() => {
    if (weights.length !== comparisons.length) {
      setWeights(comparisons.map(() => DEFAULT_WEIGHT));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparisons.length]);

  const leftPercent = useMemo(() => computeLeftPercent(scored, weights), [scored, weights]);
  const rightPercent = 100 - leftPercent;
  const winnerLabel = leftPercent === rightPercent ? null : leftPercent > rightPercent ? colLeft : colRight;
  const winnerMargin = Math.abs(leftPercent - rightPercent);

  const chartData = scored.map((s) => ({ feature: s.feature, [colLeft]: s.left, [colRight]: s.right }));

  return (
    <div className="space-y-3">
      <GlassCard variant="default" className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Side-by-side</h3>
          <span data-testid="comparison-radar-winner-badge">
            {winnerLabel ? (
              <Badge variant="success" className="text-xs font-semibold">
                {winnerLabel} wins by {winnerMargin}%
              </Badge>
            ) : (
              <Badge variant="muted" className="text-xs font-medium">
                Tie
              </Badge>
            )}
          </span>
        </div>
        <div
          ref={chartRef}
          className="h-[260px] w-full sm:h-[320px]"
          role="img"
          aria-label={`Radar comparing ${colLeft} and ${colRight}`}
        >
          {chartSize.width > 0 && chartSize.height > 0 && (
            <RadarChart width={chartSize.width} height={chartSize.height} data={chartData} outerRadius="75%">
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="feature" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
              <PolarRadiusAxis
                domain={[0, MAX_SCORE]}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                stroke="var(--border)"
              />
              <Radar
                name={colLeft}
                dataKey={colLeft}
                stroke="var(--vie-accent, var(--primary))"
                fill="var(--vie-accent, var(--primary))"
                fillOpacity={0.35}
              />
              <Radar
                name={colRight}
                dataKey={colRight}
                stroke="var(--muted-foreground)"
                fill="var(--muted-foreground)"
                fillOpacity={0.2}
              />
              <Legend />
            </RadarChart>
          )}
        </div>
      </GlassCard>

      {/* Weight sliders collapse by default — the winner split stays visible so
          the signal survives, but the six-slider control no longer competes for
          attention on first read. */}
      <GlassCard variant="outlined" className="space-y-3 p-4">
        <button
          type="button"
          onClick={() => setTunerOpen((open) => !open)}
          aria-expanded={tunerOpen}
          className="flex w-full items-center justify-between gap-2"
        >
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tune what matters
            {tunerOpen
              ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
          </span>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {colLeft} {leftPercent}% · {colRight} {rightPercent}%
          </span>
        </button>
        {tunerOpen && (
        <ul className="space-y-2">
          {scored.map((axis, index) => (
            <li
              key={`${axis.feature}-${index}`}
              className="grid grid-cols-[minmax(0,1fr)_minmax(120px,2fr)_3rem] items-center gap-3"
            >
              <span className="truncate text-sm text-foreground">{axis.feature}</span>
              <Slider
                aria-label={`Weight for ${axis.feature}`}
                min={0}
                max={MAX_SCORE}
                step={1}
                value={[weights[index] ?? DEFAULT_WEIGHT]}
                onValueChange={(next) => {
                  const value = Array.isArray(next) ? next[0] : DEFAULT_WEIGHT;
                  setWeights((prev) => {
                    const updated = prev.slice();
                    updated[index] = value ?? DEFAULT_WEIGHT;
                    return updated;
                  });
                }}
                data-testid={`comparison-radar-weight-${index}`}
              />
              <span className="text-end text-xs font-mono tabular-nums text-muted-foreground">
                {weights[index] ?? DEFAULT_WEIGHT}
              </span>
            </li>
          ))}
        </ul>
        )}
      </GlassCard>
    </div>
  );
});

interface ComparisonRow extends ReviewComparison {
  winner?: 'left' | 'right' | 'tie';
}

interface SubScore {
  category: string;
  score: number;
}

interface VerdictData {
  badge?: string;
  bottomLine?: string;
  bestFor?: string[];
  notFor?: string[];
  score?: number;
  maxScore?: number;
  subScores?: SubScore[];
}

interface ComparisonInteractiveProps {
  comparisons?: ComparisonRow[];
  pros?: string[];
  cons?: string[];
  type?: ComparisonMode;
  leftLabel?: string;
  rightLabel?: string;
  verdict?: VerdictData;
  /**
   * Force the radar hero on/off. When omitted the component decides by data:
   * radar shows automatically for ≥3 comparison rows (scoreable axes). The
   * `comparison_radar` registry alias passes `view="radar"` so the 1A
   * promotion `comparison → comparison_radar` keeps surfacing the radar.
   */
  view?: 'auto' | 'radar' | 'table';
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

/** Scoreable axes = comparison rows; radar degenerates below 3 spokes. */
function hasRadarAxes(comparisons: ComparisonRow[]): boolean {
  return comparisons.length >= RADAR_MIN_AXES;
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
function ReviewSummary({ verdict }: ReviewSummaryProps) {
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

export const ComparisonInteractive = memo(function ComparisonInteractive({
  comparisons = [],
  pros,
  cons,
  type = 'table',
  leftLabel,
  rightLabel,
  verdict,
  view = 'auto',
  nextTab: _nextTab,
  onNavigateTab: _onNavigateTab,
}: ComparisonInteractiveProps) {
  const t = useLabels();
  const [activeRow, setActiveRow] = useState(0);
  const [prosExpanded, setProsExpanded] = useState(true);
  const [consExpanded, setConsExpanded] = useState(true);

  // Radar and table are mutually exclusive views, not a stacked pair. Mobile
  // opens on the table (the radar is cramped under ~340px); desktop opens on
  // the radar hero. `view="radar"` forces the radar regardless of viewport.
  const isCompact = useMediaQuery('(max-width: 640px)');
  const [comparisonView, setComparisonView] = useState<'radar' | 'details'>(
    () => (view !== 'radar' && isCompact ? 'details' : 'radar'),
  );

  const hasComparisons = comparisons.length > 0;
  const hasPros = pros && pros.length > 0;
  const hasCons = cons && cons.length > 0;
  const hasVerdictHeader = Boolean(verdict?.bottomLine);
  const competitorName = hasComparisons ? comparisons[0].competitorName : '';
  const isReview = Boolean(competitorName);
  const colLeft = leftLabel || (isReview ? 'This Product' : t.description);
  const colRight = rightLabel || competitorName || (isReview ? 'Competitor' : t.example);

  // Radar hero when the data has enough scoreable axes (or forced via `view`).
  // `view="radar"` still needs ≥3 axes — a 2-spoke radar is a line, so it
  // gracefully falls back to the table.
  const showRadar = view !== 'table' && hasComparisons && hasRadarAxes(comparisons);

  // Verdict summary from winner fields
  const verdictSummary = useMemo(() => {
    const withWinner = comparisons.filter((c) => c.winner);
    if (withWinner.length === 0) return null;
    const leftWins = withWinner.filter((c) => c.winner === 'left').length;
    const rightWins = withWinner.filter((c) => c.winner === 'right').length;
    const ties = withWinner.filter((c) => c.winner === 'tie').length;
    return { leftWins, rightWins, ties, total: withWinner.length };
  }, [comparisons]);

  if (!hasComparisons && !hasPros && !hasCons && !hasVerdictHeader) return null;

  return (
    <div className="space-y-4">
      {/* Review summary header — renders only when verdict.bottomLine is set */}
      {hasVerdictHeader && <ReviewSummary verdict={verdict!} />}

      {/* View toggle — only when a radar hero and a detail view both exist.
          One view at a time replaces the old radar-stacked-on-table wall. */}
      {showRadar && (
        <div
          className="flex w-fit items-center gap-1 rounded-lg bg-muted/40 p-0.5"
          role="group"
          aria-label="Comparison view"
        >
          <button
            type="button"
            onClick={() => setComparisonView('radar')}
            aria-pressed={comparisonView === 'radar'}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-semibold transition-colors',
              comparisonView === 'radar'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Radar
          </button>
          <button
            type="button"
            onClick={() => setComparisonView('details')}
            aria-pressed={comparisonView === 'details'}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-semibold transition-colors',
              comparisonView === 'details'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {type === 'versus' ? 'Cards' : 'Table'}
          </button>
        </div>
      )}

      {/* Radar hero — when ≥3 scoreable axes (auto) or forced via view="radar" */}
      {showRadar && comparisonView === 'radar' && (
        <ComparisonRadarHero comparisons={comparisons} colLeft={colLeft} colRight={colRight} />
      )}

      {/* Feature comparison — table mode */}
      {hasComparisons && type === 'table' && (!showRadar || comparisonView === 'details') && (
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
      {hasComparisons && type === 'versus' && (!showRadar || comparisonView === 'details') && (
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
                      <EmojiMarker emoji="🏆" size="sm" animated={false} className="absolute -top-2 -end-1" />
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
                      <EmojiMarker emoji="🏆" size="sm" animated={false} className="absolute -top-2 -end-1" />
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
