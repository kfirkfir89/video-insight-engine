import { useUsageByFeature } from '../hooks/use-admin-api';
import { Panel } from './Panel';
import { SkeletonPanel } from './SkeletonPanel';
import { ErrorState } from './ErrorState';
import { InfoTip } from './InfoTip';
import { formatNumber } from '../lib/format';

function ms(value: number | null | undefined): string {
  return value == null ? '—' : `${Math.round(value).toLocaleString()}ms`;
}

/** Per-feature latency: avg was the only number available; p50/p95 tell the real story. */
export function LatencyPanel({ days = 30 }: { days?: number }) {
  const { data, isLoading, isError, error, refetch } = useUsageByFeature(days);

  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} title="Failed to load latency" />;
  }
  if (isLoading || !data) {
    return <SkeletonPanel size="lg" />;
  }

  const rows = [...data].sort((a, b) => (b.p95_duration_ms ?? 0) - (a.p95_duration_ms ?? 0));

  const header = (
    <span className="inline-flex items-center gap-1">
      <span>Latency by feature</span>
      <InfoTip label="Latency explanation">
        Wall-clock time per LLM call. p95 = 95% of calls finished within this time — the
        number users feel; the average hides the slow tail.
      </InfoTip>
    </span>
  );

  return (
    <Panel title={header} tone="raised" padding="none" data-testid="latency-panel">
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] p-4">No calls in window</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left p-2 pl-4 font-medium text-[var(--color-text-muted)]">Feature</th>
                <th className="text-right p-2 font-medium text-[var(--color-text-muted)]">Calls</th>
                <th className="text-right p-2 font-medium text-[var(--color-text-muted)]">Avg</th>
                <th className="text-right p-2 font-medium text-[var(--color-text-muted)]">p50</th>
                <th className="text-right p-2 pr-4 font-medium text-[var(--color-text-muted)]">p95</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.feature} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="p-2 pl-4 truncate max-w-[220px]">{row.feature}</td>
                  <td className="p-2 text-right tabular-nums">{formatNumber(row.calls)}</td>
                  <td className="p-2 text-right tabular-nums text-[var(--color-text-muted)]">{ms(row.avg_duration_ms)}</td>
                  <td className="p-2 text-right tabular-nums">{ms(row.p50_duration_ms)}</td>
                  <td className="p-2 pr-4 text-right tabular-nums font-medium">{ms(row.p95_duration_ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
