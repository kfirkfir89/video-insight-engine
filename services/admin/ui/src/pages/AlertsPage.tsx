import { useAlertsRecent, useAlertConfig } from '../hooks/use-admin-api';

export function AlertsPage() {
  const { data: alerts, isLoading } = useAlertsRecent(50);
  const { data: config } = useAlertConfig();

  return (
    <div className="space-y-6">
      {config && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dim)] p-4">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Alert Thresholds</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-[var(--color-text-muted)]">Cost per call</p>
              <p className="font-mono font-bold">${config.cost_threshold_usd}</p>
            </div>
            <div>
              <p className="text-[var(--color-text-muted)]">Daily spike</p>
              <p className="font-mono font-bold">{config.daily_spike_multiplier}x avg</p>
            </div>
            <div>
              <p className="text-[var(--color-text-muted)]">Failure rate</p>
              <p className="font-mono font-bold">{((config.failure_rate_threshold ?? 0.2) * 100).toFixed(0)}%</p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dim)] overflow-hidden">
        <h3 className="text-sm font-medium text-[var(--color-text-muted)] p-4 pb-2">Recent Alerts</h3>
        {isLoading ? (
          <div className="h-32 animate-pulse" />
        ) : !alerts || alerts.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] p-4">No alerts</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left p-2 pl-4 font-medium text-[var(--color-text-muted)]">Type</th>
                  <th className="text-left p-2 font-medium text-[var(--color-text-muted)]">Model</th>
                  <th className="text-left p-2 font-medium text-[var(--color-text-muted)]">Feature</th>
                  <th className="text-right p-2 font-medium text-[var(--color-text-muted)]">Cost</th>
                  <th className="text-right p-2 pr-4 font-medium text-[var(--color-text-muted)]">Time</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a, i) => (
                  <tr key={String(a._id ?? i)} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="p-2 pl-4 font-medium text-[var(--color-danger)]">{String(a.type ?? '')}</td>
                    <td className="p-2 font-mono truncate max-w-[160px]">{String(a.model ?? '')}</td>
                    <td className="p-2">{String(a.feature ?? '')}</td>
                    <td className="p-2 text-right font-mono">${Number(a.cost_usd ?? 0).toFixed(4)}</td>
                    <td className="p-2 pr-4 text-right text-[var(--color-text-muted)]">{String(a.timestamp ?? '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
