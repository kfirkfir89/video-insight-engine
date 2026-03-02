import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useUsageDaily } from '../hooks/use-admin-api';

export function CostChart({ days = 30 }: { days?: number }) {
  const { data, isLoading } = useUsageDaily(days);

  if (isLoading || !data) {
    return <div className="h-72 rounded-xl bg-[var(--color-surface-dim)] border border-[var(--color-border)] animate-pulse" />;
  }

  return (
    <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)]">
      <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Daily Cost Trend</h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            tickFormatter={(v: string) => v.slice(5)}
            axisLine={{ stroke: 'var(--color-border)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            tickFormatter={(v: number) => `$${v.toFixed(2)}`}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
            formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(4)}`, 'Cost']}
          />
          <Area
            type="monotone"
            dataKey="cost_usd"
            stroke="var(--color-primary)"
            strokeWidth={2}
            fill="url(#costGradient)"
            dot={false}
            activeDot={{ r: 4, fill: 'var(--color-primary)', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
