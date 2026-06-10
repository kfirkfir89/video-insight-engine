import { memo, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Plus, Minus, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HeroCard, FadeIn, GlassCard, StatPill } from '@/components/vie';
import { Button } from '@/components/ui/button';
import { EmptyTabState } from './EmptyTabState';


interface BudgetBreakdownItem {
  category: string;
  amount: number;
  emoji?: string;
  notes?: string;
}

interface BudgetInteractiveProps {
  total: number;
  currency?: string;
  breakdown: BudgetBreakdownItem[];
  savingTips?: string[];
  editable?: boolean;
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

/**
 * Donut/dot/bar palette — a single-hue ramp of the domain accent token. All
 * eight steps are the same hue varied only by alpha (1.0 → 0.3) so segments
 * stay distinguishable while reading as one domain color (no second hue).
 */
const DONUT_COLORS = [
  'oklch(from var(--vie-accent) l c h / 1)',
  'oklch(from var(--vie-accent) l c h / 0.9)',
  'oklch(from var(--vie-accent) l c h / 0.8)',
  'oklch(from var(--vie-accent) l c h / 0.7)',
  'oklch(from var(--vie-accent) l c h / 0.6)',
  'oklch(from var(--vie-accent) l c h / 0.5)',
  'oklch(from var(--vie-accent) l c h / 0.4)',
  'oklch(from var(--vie-accent) l c h / 0.3)',
];

function formatCurrency(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export const BudgetInteractive = memo(function BudgetInteractive({
  total: _total,
  currency = 'USD',
  breakdown,
  savingTips,
  editable = false,
  nextTab: _nextTab,
  onNavigateTab: _onNavigateTab,
}: BudgetInteractiveProps) {
  const [editedAmounts, setEditedAmounts] = useState<Map<number, number>>(new Map());
  const [animatedTotal, setAnimatedTotal] = useState(0);
  const [highlightedCategory, setHighlightedCategory] = useState<number | null>(null);
  const animRef = useRef<number>(0);

  // Compute current amounts with edits applied
  const currentBreakdown = useMemo(
    () => breakdown.map((item, i) => ({
      ...item,
      amount: editedAmounts.get(i) ?? item.amount,
    })),
    [breakdown, editedAmounts],
  );

  const currentTotal = useMemo(
    () => currentBreakdown.reduce((sum, item) => sum + item.amount, 0),
    [currentBreakdown],
  );

  // Animated total count-up — transitions from previous value
  const prevTotalRef = useRef(0);
  useEffect(() => {
    const target = currentTotal;
    const from = prevTotalRef.current;
    prevTotalRef.current = target;
    const duration = 600;
    const start = performance.now();

    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setAnimatedTotal(Math.round(from + (target - from) * eased));
      if (progress < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, [currentTotal]);

  const adjustAmount = useCallback((index: number, delta: number) => {
    setEditedAmounts((prev) => {
      const next = new Map(prev);
      const current = next.get(index) ?? breakdown[index].amount;
      next.set(index, Math.max(0, current + delta));
      return next;
    });
  }, [breakdown]);

  // Donut chart segments
  const donutSegments = useMemo(() => {
    if (currentTotal === 0) return [];
    let accumulated = 0;
    const circumference = 2 * Math.PI * 40; // radius = 40
    return currentBreakdown.map((item, i) => {
      const fraction = item.amount / currentTotal;
      const dashLength = fraction * circumference;
      const dashOffset = -accumulated * circumference;
      accumulated += fraction;
      return { dashLength, dashOffset, color: DONUT_COLORS[i % DONUT_COLORS.length], index: i };
    });
  }, [currentBreakdown, currentTotal]);

  const potentialSavings = savingTips && savingTips.length > 0
    ? Math.round(currentTotal * 0.15)
    : null;

  if (breakdown.length === 0) return <EmptyTabState message="No cost breakdown was extracted for this video." icon={Wallet} />;

  return (
    <div className="space-y-4">
      {/* Hero with animated total */}
      <HeroCard emoji="💰" title={formatCurrency(animatedTotal, currency)} subtitle="Total Budget">
        <div className="flex items-center gap-2 mt-2">
          <StatPill value={String(currentBreakdown.length)} label="categories" />
          {potentialSavings != null && (
            <StatPill value={formatCurrency(potentialSavings, currency)} label="potential savings" />
          )}
        </div>
      </HeroCard>

      {/* Donut chart */}
      {currentBreakdown.length > 1 && (
        <FadeIn>
          <GlassCard className="flex justify-center py-2">
            <svg width="120" height="120" viewBox="0 0 100 100" className="transform -rotate-90">
              {donutSegments.map((seg) => (
                <circle
                  key={seg.index}
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={highlightedCategory === seg.index ? 12 : 8}
                  strokeDasharray={`${seg.dashLength} ${2 * Math.PI * 40 - seg.dashLength}`}
                  strokeDashoffset={seg.dashOffset}
                  className="cursor-pointer transition-all duration-200"
                  opacity={highlightedCategory != null && highlightedCategory !== seg.index ? 0.3 : 1}
                  onClick={() => setHighlightedCategory(highlightedCategory === seg.index ? null : seg.index)}
                />
              ))}
            </svg>
          </GlassCard>
        </FadeIn>
      )}

      {/* Breakdown */}
      <GlassCard className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Breakdown</h4>
        {currentBreakdown.map((item, index) => {
          const percent = currentTotal > 0 ? (item.amount / currentTotal) * 100 : 0;
          const isHighlighted = highlightedCategory === index;
          return (
            <FadeIn key={index} index={index}>
              <div
                className={cn(
                  'space-y-1.5 p-1.5 rounded-lg transition-colors',
                  isHighlighted && 'bg-[var(--vie-accent)]/5 ring-1 ring-[var(--vie-accent)]/20',
                )}
                onClick={() => setHighlightedCategory(isHighlighted ? null : index)}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold leading-snug flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
                      aria-hidden="true"
                    />
                    {item.emoji && <span className="me-0.5" aria-hidden="true">{item.emoji}</span>}
                    {item.category}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {editable && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); adjustAmount(index, -10); }}
                          aria-label={`Decrease ${item.category}`}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); adjustAmount(index, 10); }}
                          aria-label={`Increase ${item.category}`}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    <span className="text-sm font-semibold tabular-nums tracking-tight text-muted-foreground">{formatCurrency(item.amount, currency)}</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${Math.min(percent, 100)}%`,
                      backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length],
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground/60 tabular-nums">{Math.round(percent)}%</span>
                  {item.notes && <span className="text-xs leading-relaxed text-muted-foreground/70">{item.notes}</span>}
                </div>
              </div>
            </FadeIn>
          );
        })}
      </GlassCard>

      {/* Saving tips */}
      {savingTips && savingTips.length > 0 && (
        <FadeIn index={currentBreakdown.length}>
          <GlassCard variant="outlined" className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-success">Saving Tips</h4>
            <ul className="space-y-1.5">
              {savingTips.map((tip, i) => (
                <li key={i} className="flex items-baseline gap-2 text-sm leading-relaxed text-muted-foreground">
                  <span className="w-1 h-1 rounded-full bg-success/70 shrink-0 translate-y-1.5" />
                  {tip}
                </li>
              ))}
            </ul>
          </GlassCard>
        </FadeIn>
      )}

    </div>
  );
});
