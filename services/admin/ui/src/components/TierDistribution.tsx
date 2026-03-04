import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { useTierDistribution } from '../hooks/use-admin-api';

export function TierDistribution() {
  const { data, isLoading } = useTierDistribution();

  if (isLoading || !data) {
    return <div className="h-52 rounded-xl bg-[var(--color-surface-dim)] border border-[var(--color-border)] animate-pulse" />;
  }

  if (data.length === 0) {
    return (
      <div className="h-52 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] flex items-center justify-center">
        <p className="text-sm text-[var(--color-text-faint)]">No tier data available</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: `${d.tier} (${d.percentage}%)`,
  }));

  return (
    <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)]" data-testid="tier-distribution">
      <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">User Tiers</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 40 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="tier"
            width={50}
            tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
            formatter={(v: number | undefined) => [`${(v ?? 0).toLocaleString()} users`, 'Count']}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24} fill="var(--chart-1)">
            <LabelList
              dataKey="count"
              position="right"
              style={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
