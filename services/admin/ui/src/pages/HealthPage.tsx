import { ServiceHealth } from '../components/ServiceHealth';
import { useHealthUptime } from '../hooks/use-admin-api';
import { Panel } from '../components/Panel';
import { SkeletonPanel } from '../components/SkeletonPanel';
import { ErrorState } from '../components/ErrorState';
import { InfoTip } from '../components/InfoTip';

function uptimeColor(pct: number): string {
  if (pct >= 99) return 'var(--color-success)';
  if (pct >= 95) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

export function HealthPage() {
  const { data: uptime, isLoading, isError, error, refetch } = useHealthUptime(7);

  const uptimeHeader = (
    <span className="inline-flex items-center gap-1">
      <span>7-Day Uptime</span>
      <InfoTip label="Uptime explanation">
        Uptime = successful health checks / total checks in the selected window.
      </InfoTip>
    </span>
  );

  return (
    <div className="space-y-6">
      <ServiceHealth />
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} title="Failed to load uptime" />
      ) : isLoading ? (
        <SkeletonPanel size="lg" />
      ) : uptime && Object.keys(uptime).length > 0 ? (
        <Panel title={uptimeHeader} tone="dim" padding="md">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(uptime).map(([service, info]) => (
              <div key={service} className="text-center">
                <p
                  className="text-2xl font-bold tabular-nums"
                  style={{ color: uptimeColor(info.uptime_pct) }}
                >
                  {info.uptime_pct}%
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">{service}</p>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
