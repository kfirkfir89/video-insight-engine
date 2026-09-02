import { useHealthOverview } from '../hooks/use-admin-api';
import type { SystemStatus } from '../lib/api';
import { timeAgo } from '../lib/format';

const STATUS_COLOR: Record<SystemStatus, string> = {
  healthy: 'var(--color-success)',
  degraded: 'var(--color-warning)',
  down: 'var(--color-danger)',
  unknown: 'var(--color-text-muted)',
};

const STATUS_LABEL: Record<SystemStatus, string> = {
  healthy: 'All systems healthy',
  degraded: 'Degraded',
  down: 'Service down',
  unknown: 'Status unknown',
};

/** Backend rollup is a free-form string on the wire; anything unexpected renders as unknown, not blank. */
function toSystemStatus(value: string): SystemStatus {
  return Object.hasOwn(STATUS_LABEL, value) ? (value as SystemStatus) : 'unknown';
}

/** One-glance rollup of /health/overview: worst service status wins. */
export function SystemStatusBadge() {
  const { data, isError } = useHealthOverview();

  // React Query keeps the last good payload on error; don't present it as current.
  const live = isError ? undefined : data;
  const status: SystemStatus = live ? toSystemStatus(live.status) : 'unknown';
  const unhealthy = live
    ? Object.entries(live.services)
        .filter(([, s]) => s.status !== 'healthy')
        .map(([name, s]) => `${name}: ${s.status}`)
    : [];

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"
      data-testid="system-status"
      data-status={status}
    >
      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLOR[status] }} />
      <span className="font-medium" style={{ color: STATUS_COLOR[status] }}>
        {STATUS_LABEL[status]}
      </span>
      {unhealthy.length > 0 && (
        <span className="text-xs text-[var(--color-text-muted)] truncate">{unhealthy.join(' · ')}</span>
      )}
      {live && (
        <span className="ml-auto text-xs text-[var(--color-text-faint)]">checked {timeAgo(live.checked_at)}</span>
      )}
    </div>
  );
}
