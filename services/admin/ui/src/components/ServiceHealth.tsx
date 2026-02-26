import { useHealthServices } from '../hooks/use-admin-api';

const statusColor: Record<string, string> = {
  healthy: 'var(--color-success)',
  degraded: 'var(--color-warning)',
  timeout: 'var(--color-warning)',
  down: 'var(--color-danger)',
};

export function ServiceHealth() {
  const { data, isLoading } = useHealthServices();

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-[var(--color-surface-dim)] border border-[var(--color-border)] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="service-health">
      {Object.entries(data).map(([name, info]) => (
        <div key={name} className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dim)]">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: statusColor[info.status] ?? 'var(--color-text-muted)' }}
            />
            <span className="text-xs font-medium truncate">{name}</span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            {info.status}{info.response_ms ? ` (${info.response_ms}ms)` : ''}
          </p>
        </div>
      ))}
    </div>
  );
}
