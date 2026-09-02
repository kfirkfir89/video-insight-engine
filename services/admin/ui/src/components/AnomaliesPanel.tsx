import { useUsageAnomalies } from '../hooks/use-admin-api';
import { Panel } from './Panel';
import { SkeletonPanel } from './SkeletonPanel';
import { ErrorState } from './ErrorState';
import { InfoTip } from './InfoTip';
import { formatCost, formatUsageVolume, timeAgo } from '../lib/format';

interface AnomaliesPanelProps {
  days?: number;
  thresholdUsd?: number;
}

export function AnomaliesPanel({ days = 7, thresholdUsd = 0.5 }: AnomaliesPanelProps = {}) {
  const { data, isLoading, isError, error, refetch } = useUsageAnomalies(thresholdUsd, days);

  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} title="Failed to load expensive calls" />;
  }
  if (isLoading || !data) {
    return <SkeletonPanel size="lg" />;
  }

  const header = (
    <span className="inline-flex items-center gap-1">
      <span>Expensive calls</span>
      <InfoTip label="Expensive calls explanation">
        Single LLM calls above ${thresholdUsd.toFixed(2)} in the last {days} days, most expensive first.
        Same threshold as the high_cost_call alert.
      </InfoTip>
    </span>
  );

  return (
    <Panel title={header} tone="raised" padding="none" data-testid="anomalies-panel">
      {data.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] p-4">No calls above ${thresholdUsd.toFixed(2)}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left p-2 pl-4 font-medium text-[var(--color-text-muted)]">Model</th>
                <th className="text-left p-2 font-medium text-[var(--color-text-muted)]">Feature</th>
                <th className="text-left p-2 font-medium text-[var(--color-text-muted)]">Video</th>
                <th className="text-right p-2 font-medium text-[var(--color-text-muted)]">Cost</th>
                <th className="text-right p-2 font-medium text-[var(--color-text-muted)]">Tokens</th>
                <th className="text-right p-2 pr-4 font-medium text-[var(--color-text-muted)]">When</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row._id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="p-2 pl-4 font-mono truncate max-w-[180px]">{row.model ?? '—'}</td>
                  <td className="p-2 truncate max-w-[140px]">{row.feature ?? '—'}</td>
                  <td className="p-2 font-mono">{row.video_id ?? '—'}</td>
                  <td className="p-2 text-right font-mono font-medium text-[var(--color-danger)]">
                    {formatCost(row.cost_usd)}
                  </td>
                  <td className="p-2 text-right">{formatUsageVolume(row)}</td>
                  <td className="p-2 pr-4 text-right text-[var(--color-text-muted)]">{timeAgo(row.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
