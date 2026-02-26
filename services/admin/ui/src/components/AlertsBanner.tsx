import { useAlertsRecent } from '../hooks/use-admin-api';

export function AlertsBanner() {
  const { data } = useAlertsRecent(5);

  if (!data || data.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1" data-testid="alerts-banner">
      {data.map((alert, i) => (
        <div
          key={String(alert._id ?? i)}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-xs"
        >
          <span className="font-medium text-[var(--color-danger)]">
            {String(alert.type ?? 'alert')}
          </span>
          {alert.cost_usd != null && (
            <span className="ml-2 text-[var(--color-text-muted)]">${Number(alert.cost_usd).toFixed(4)}</span>
          )}
          {alert.model != null && (
            <span className="ml-2 text-[var(--color-text-muted)]">{String(alert.model)}</span>
          )}
        </div>
      ))}
    </div>
  );
}
