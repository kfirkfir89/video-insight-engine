import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useUsageDaily } from '../hooks/use-admin-api';

export function CostChart({ days = 30 }: { days?: number }) {
  const { data, isLoading } = useUsageDaily(days);

  if (isLoading || !data) {
    return <div className="h-64 rounded-xl bg-[var(--color-surface-dim)] border border-[var(--color-border)] animate-pulse" />;
  }

  return (
    <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dim)]">
      <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Daily Cost Trend</h3>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            tickFormatter={(v: number) => `$${v.toFixed(2)}`}
          />
          <Tooltip
            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
            formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(4)}`, 'Cost']}
          />
          <Line type="monotone" dataKey="cost_usd" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
