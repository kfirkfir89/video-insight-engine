import { useAlertsRecent } from '../hooks/use-admin-api';
import { ErrorState } from './ErrorState';
import { describeAlert, getSeverity, severityColor } from '../lib/alerts';

export function AlertsBanner() {
  const { data, isError, error, refetch } = useAlertsRecent(5);

  if (isError) {
    return (
      <div data-testid="alerts-banner">
        <ErrorState error={error} onRetry={() => refetch()} title="Failed to load alerts" compact />
      </div>
    );
  }

  if (!data || data.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1" data-testid="alerts-banner">
      {data.map((alert, i) => {
        const color = severityColor(getSeverity(alert));
        return (
          <div
            key={String(alert._id ?? i)}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg border text-xs"
            style={{ borderColor: `color-mix(in oklab, ${color} 25%, transparent)`, background: `color-mix(in oklab, ${color} 10%, transparent)` }}
            data-severity={getSeverity(alert)}
          >
            <span className="font-medium" style={{ color }}>
              {String(alert.type ?? 'alert')}
            </span>
            <span className="ml-2 text-[var(--color-text-muted)]">{describeAlert(alert)}</span>
          </div>
        );
      })}
    </div>
  );
}
