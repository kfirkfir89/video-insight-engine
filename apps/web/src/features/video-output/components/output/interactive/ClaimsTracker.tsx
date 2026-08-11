import { memo, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, Clock, BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ClaimItem, ClaimStatus } from '@vie/types';
import { GlassCard, FadeIn, Badge } from '@/components/vie';
import { EmptyTabState } from './EmptyTabState';

interface ClaimsTrackerProps {
  claims: ClaimItem[];
  onSeek?: (seconds: number) => void;
}

type StatusFilter = ClaimStatus | 'all';

const STATUS_META: Record<
  ClaimStatus,
  { label: string; variant: 'success' | 'warning' | 'muted'; Icon: typeof CheckCircle2 }
> = {
  verified: { label: 'Verified', variant: 'success', Icon: CheckCircle2 },
  disputed: { label: 'Disputed', variant: 'warning', Icon: AlertTriangle },
  context: { label: 'Context', variant: 'muted', Icon: Info },
};

const FILTER_ORDER: StatusFilter[] = ['all', 'verified', 'disputed', 'context'];

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * ClaimsTracker — the news signature surface. Renders each factual claim with
 * who made it and a status badge (verified / disputed / context), plus an
 * optional source citation and a seek-to-timestamp button. A status filter bar
 * lets the reader isolate disputed claims — the accountability lens that
 * separates a news artifact from a plain summary.
 */
export const ClaimsTracker = memo(function ClaimsTracker({ claims, onSeek }: ClaimsTrackerProps) {
  const [filter, setFilter] = useState<StatusFilter>('all');

  const counts = useMemo(() => {
    const acc: Record<ClaimStatus, number> = { verified: 0, disputed: 0, context: 0 };
    for (const c of claims) acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, [claims]);

  const visible = useMemo(
    () => (filter === 'all' ? claims : claims.filter((c) => c.status === filter)),
    [claims, filter],
  );

  if (claims.length === 0) {
    return <EmptyTabState message="No claims were tracked for this video." icon={BadgeCheck} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter claims by status">
        {FILTER_ORDER.map((option) => {
          const active = filter === option;
          const count = option === 'all' ? claims.length : counts[option];
          if (option !== 'all' && count === 0) return null;
          const label = option === 'all' ? 'All' : STATUS_META[option].label;
          return (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(option)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                active
                  ? 'border-[var(--vie-accent)] bg-[var(--vie-accent)]/10 text-[var(--vie-accent)]'
                  : 'border-border text-muted-foreground hover:bg-muted/40',
              )}
            >
              {label} <span className="tabular-nums opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      <ul className="flex flex-col gap-3" aria-label="Tracked claims">
        {visible.map((claim, i) => {
          const meta = STATUS_META[claim.status];
          const { Icon } = meta;
          return (
            <FadeIn key={`${claim.claim}-${i}`} index={i}>
              <li>
                <GlassCard className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium leading-snug text-foreground">{claim.claim}</p>
                    <Badge variant={meta.variant} className="shrink-0">
                      <Icon className="size-3 shrink-0" aria-hidden="true" />
                      {meta.label}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {claim.source ? (
                      <span>
                        <span className="text-muted-foreground/70">Claimed by</span>{' '}
                        <span className="font-medium text-foreground/90">{claim.source}</span>
                      </span>
                    ) : null}
                    {claim.timestamp != null && onSeek ? (
                      <button
                        type="button"
                        onClick={() => onSeek(claim.timestamp as number)}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-[var(--vie-accent)] hover:bg-[var(--vie-accent)]/10"
                        aria-label={`Jump to ${formatTimestamp(claim.timestamp)}`}
                      >
                        <Clock className="size-3 shrink-0" aria-hidden="true" />
                        {formatTimestamp(claim.timestamp)}
                      </button>
                    ) : null}
                  </div>

                  {claim.sourceCitation ? (
                    <p className="border-t border-border/60 pt-2 text-xs italic text-muted-foreground">
                      {claim.sourceCitation}
                    </p>
                  ) : null}
                </GlassCard>
              </li>
            </FadeIn>
          );
        })}
      </ul>
    </div>
  );
});
