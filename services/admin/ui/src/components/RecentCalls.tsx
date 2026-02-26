import { useUsageRecent } from '../hooks/use-admin-api';

export function RecentCalls() {
  const { data, isLoading } = useUsageRecent(15);

  if (isLoading || !data) {
    return <div className="h-48 rounded-xl bg-[var(--color-surface-dim)] border border-[var(--color-border)] animate-pulse" />;
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dim)] overflow-hidden">
      <h3 className="text-sm font-medium text-[var(--color-text-muted)] p-4 pb-2">Recent Calls</h3>
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
              <tr key={String(row._id ?? i)} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface)]">
                <td className="p-2 pl-4 font-mono truncate max-w-[180px]">{String(row.model ?? '')}</td>
                <td className="p-2 truncate max-w-[120px]">{String(row.feature ?? '')}</td>
                <td className="p-2 text-right font-mono">${Number(row.cost_usd ?? 0).toFixed(4)}</td>
                <td className="p-2 text-right">{Number(row.tokens_in ?? 0) + Number(row.tokens_out ?? 0)}</td>
                <td className="p-2 pr-4 text-right">{Number(row.duration_ms ?? 0)}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
