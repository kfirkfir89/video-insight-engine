import { useUsageRecent } from '../hooks/use-admin-api';
import { Panel } from './Panel';
import { SkeletonPanel } from './SkeletonPanel';
import { ErrorState } from './ErrorState';
import { formatUsageVolume } from '../lib/format';

export function RecentCalls() {
  const { data, isLoading, isError, error, refetch } = useUsageRecent(15);

  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} title="Failed to load recent calls" />;
  }

  if (isLoading || !data) {
    return <SkeletonPanel size="xl" />;
  }

  return (
    <Panel title="Recent Calls" tone="raised" padding="none">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="text-left p-2 pl-4 font-medium text-[var(--color-text-muted)]">Model</th>
              <th className="text-left p-2 font-medium text-[var(--color-text-muted)]">Feature</th>
              <th className="text-right p-2 font-medium text-[var(--color-text-muted)]">Cost</th>
              <th className="text-right p-2 font-medium text-[var(--color-text-muted)]">Tokens</th>
              <th className="text-right p-2 pr-4 font-medium text-[var(--color-text-muted)]">Duration</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={String(row._id ?? i)} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-dim)]">
                <td className="p-2 pl-4 font-mono truncate max-w-[180px]">{String(row.model ?? '')}</td>
                <td className="p-2 truncate max-w-[120px]">{String(row.feature ?? '')}</td>
                <td className="p-2 text-right font-mono">${Number(row.cost_usd ?? 0).toFixed(4)}</td>
                <td className="p-2 text-right">
                  {formatUsageVolume({
                    unit: row.unit == null ? null : String(row.unit),
                    audio_seconds: Number(row.audio_seconds ?? 0),
                    tokens_in: Number(row.tokens_in ?? 0),
                    tokens_out: Number(row.tokens_out ?? 0),
                  })}
                </td>
                <td className="p-2 pr-4 text-right">{Number(row.duration_ms ?? 0)}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
