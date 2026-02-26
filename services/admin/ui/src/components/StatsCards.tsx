import { useUsageStats } from '../hooks/use-admin-api';

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const fmtUsd = (n: number) => `$${n.toFixed(4)}`;

export function StatsCards({ days = 30 }: { days?: number }) {
  const { data, isLoading } = useUsageStats(days);

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="stats-cards">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-[var(--color-surface-dim)] border border-[var(--color-border)] animate-pulse" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'Total Cost', value: fmtUsd(data.total_cost_usd ?? 0), color: 'var(--color-primary)' },
    { label: 'Total Calls', value: fmt(data.total_calls ?? 0), color: 'var(--color-success)' },
    { label: 'Avg Duration', value: `${fmt(data.avg_duration_ms ?? 0)}ms`, color: 'var(--color-warning)' },
    { label: 'Success Rate', value: data.total_calls ? `${((data.success_count / data.total_calls) * 100).toFixed(1)}%` : 'N/A', color: 'var(--color-success)' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="stats-cards">
      {cards.map((c) => (
        <div key={c.label} className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dim)]">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">{c.label}</p>
          <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}
