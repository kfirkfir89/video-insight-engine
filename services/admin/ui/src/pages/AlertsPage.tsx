import { useMemo, useState } from 'react';
import { useAlertsRecent, useAlertConfig } from '../hooks/use-admin-api';
import { Panel } from '../components/Panel';
import { SkeletonPanel } from '../components/SkeletonPanel';
import { ErrorState } from '../components/ErrorState';
import { timeAgo } from '../lib/format';

type SeverityFilter = 'all' | 'critical' | 'warning' | 'info';

const FILTERS: Array<{ id: SeverityFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'critical', label: 'Critical' },
  { id: 'warning', label: 'Warning' },
  { id: 'info', label: 'Info' },
];

const CRITICAL_MATCH = /(critical|error|failure|exceed|anomal)/i;
const WARNING_MATCH = /(warn|spike|threshold|degraded)/i;
const INFO_MATCH = /(info|notice)/i;

function getSeverity(alert: Record<string, unknown>): SeverityFilter {
  const raw = String(alert.severity ?? alert.level ?? alert.type ?? '').toLowerCase();
  if (!raw) return 'info';
  if (raw.includes('critical') || raw.includes('error') || raw.includes('failure') || CRITICAL_MATCH.test(raw)) return 'critical';
  if (WARNING_MATCH.test(raw)) return 'warning';
  if (INFO_MATCH.test(raw)) return 'info';
  return 'info';
}

function severityColor(sev: SeverityFilter): string {
  if (sev === 'critical') return 'var(--color-danger)';
  if (sev === 'warning') return 'var(--color-warning)';
  return 'var(--color-text-muted)';
}

interface AlertsPageProps {
  /** Reserved for future filtering. Accepted so routed pages have a uniform signature. */
  days?: number;
}

export function AlertsPage(_props: AlertsPageProps = {}) {
  void _props;
  const { data: alerts, isLoading, isError, error, refetch } = useAlertsRecent(50);
  const { data: config } = useAlertConfig();
  const [filter, setFilter] = useState<SeverityFilter>('all');

  const filtered = useMemo(() => {
    if (!alerts) return [];
    if (filter === 'all') return alerts;
    return alerts.filter((a) => getSeverity(a) === filter);
  }, [alerts, filter]);

  return (
    <div className="space-y-6">
      {config && (
        <Panel title="Alert Thresholds" tone="dim" padding="md">
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
        </Panel>
      )}

      <div
        role="group"
        aria-label="Filter alerts by severity"
        className="inline-flex gap-0.5 p-0.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
        data-testid="alerts-severity-filter"
      >
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const base = 'px-2.5 py-1 text-xs rounded-md transition-colors font-medium';
          const state = active
            ? 'bg-[var(--color-primary)] text-white'
            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-dim)] hover:text-[var(--color-text)]';
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(f.id)}
              className={`${base} ${state}`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} title="Failed to load alerts" />
      ) : isLoading ? (
        <SkeletonPanel size="xl" />
      ) : (
        <Panel title="Recent Alerts" tone="dim" padding="none">
          {!filtered || filtered.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] p-4">
              {filter === 'all' ? 'No alerts' : `No ${filter} alerts`}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left p-2 pl-4 font-medium text-[var(--color-text-muted)]">Severity</th>
                    <th className="text-left p-2 font-medium text-[var(--color-text-muted)]">Type</th>
                    <th className="text-left p-2 font-medium text-[var(--color-text-muted)]">Model</th>
                    <th className="text-left p-2 font-medium text-[var(--color-text-muted)]">Feature</th>
                    <th className="text-right p-2 font-medium text-[var(--color-text-muted)]">Cost</th>
                    <th className="text-right p-2 pr-4 font-medium text-[var(--color-text-muted)]">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, i) => {
                    const sev = getSeverity(a);
                    const iso = a.timestamp == null ? null : String(a.timestamp);
                    return (
                      <tr key={String(a._id ?? i)} className="border-b border-[var(--color-border)] last:border-0">
                        <td className="p-2 pl-4">
                          <span
                            className="inline-flex items-center gap-1.5 font-medium capitalize"
                            style={{ color: severityColor(sev) }}
                          >
                            <span
                              className="inline-block w-2 h-2 rounded-full"
                              style={{ background: severityColor(sev) }}
                            />
                            {sev}
                          </span>
                        </td>
                        <td className="p-2 font-medium text-[var(--color-text)]">{String(a.type ?? '')}</td>
                        <td className="p-2 font-mono truncate max-w-[160px]">{String(a.model ?? '')}</td>
                        <td className="p-2">{String(a.feature ?? '')}</td>
                        <td className="p-2 text-right font-mono">${Number(a.cost_usd ?? 0).toFixed(4)}</td>
                        <td className="p-2 pr-4 text-right text-[var(--color-text-muted)]">
                          {timeAgo(iso)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
