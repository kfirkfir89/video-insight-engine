import { useUsageStats } from '../hooks/use-admin-api';
import { DollarIcon, ZapIcon, ClockIcon, CheckCircleIcon, CoinsIcon } from './icons';

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const fmtUsd = (n: number) => `$${n.toFixed(4)}`;

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

const CARD_CONFIG = [
  { key: 'cost', icon: DollarIcon, color: 'var(--color-primary)', soft: 'var(--color-primary-soft)' },
  { key: 'calls', icon: ZapIcon, color: 'var(--color-success)', soft: 'var(--color-success-soft)' },
  { key: 'duration', icon: ClockIcon, color: 'var(--color-warning)', soft: 'var(--color-warning-soft)' },
  { key: 'success', icon: CheckCircleIcon, color: 'var(--color-success)', soft: 'var(--color-success-soft)' },
  { key: 'tokens', icon: CoinsIcon, color: 'var(--color-primary)', soft: 'var(--color-primary-soft)' },
];

export function StatsCards({ days = 30 }: { days?: number }) {
  const { data, isLoading } = useUsageStats(days);

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4" data-testid="stats-cards">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-[var(--color-surface-dim)] border border-[var(--color-border)] animate-pulse" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'Total Cost', value: fmtUsd(data.total_cost_usd ?? 0), ...CARD_CONFIG[0] },
    { label: 'Total Calls', value: fmt(data.total_calls ?? 0), ...CARD_CONFIG[1] },
    { label: 'Avg Duration', value: `${fmt(data.avg_duration_ms ?? 0)}ms`, ...CARD_CONFIG[2] },
    { label: 'Success Rate', value: data.total_calls ? `${((data.success_count / data.total_calls) * 100).toFixed(1)}%` : 'N/A', ...CARD_CONFIG[3] },
    { label: 'Total Tokens', value: fmtTokens(data.total_tokens ?? 0), ...CARD_CONFIG[4] },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4" data-testid="stats-cards">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className="relative overflow-hidden p-4 rounded-xl border border-[var(--color-border)]"
            style={{ background: c.soft, borderLeft: `4px solid ${c.color}` }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <span style={{ color: c.color }}><Icon /></span>
              <p className="text-xs font-medium text-[var(--color-text-muted)]">{c.label}</p>
            </div>
            <p className="text-3xl font-bold tracking-tight" style={{ color: c.color }}>{c.value}</p>
          </div>
        );
      })}
    </div>
  );
}
