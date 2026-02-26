import { ServiceHealth } from '../components/ServiceHealth';
import { useHealthUptime } from '../hooks/use-admin-api';

export function HealthPage() {
  const { data: uptime } = useHealthUptime(7);

  return (
    <div className="space-y-6">
      <ServiceHealth />
      {uptime && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dim)] p-4">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">7-Day Uptime</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(uptime).map(([service, info]) => (
              <div key={service} className="text-center">
                <p className="text-2xl font-bold" style={{ color: info.uptime_pct >= 99 ? 'var(--color-success)' : info.uptime_pct >= 95 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                  {info.uptime_pct}%
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">{service}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
