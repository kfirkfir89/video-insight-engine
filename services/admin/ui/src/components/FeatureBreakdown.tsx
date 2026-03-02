import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { useUsageByFeature } from '../hooks/use-admin-api';

export function FeatureBreakdown({ days = 30 }: { days?: number }) {
  const { data, isLoading } = useUsageByFeature(days);

  if (isLoading || !data) {
    return <div className="h-72 rounded-xl bg-[var(--color-surface-dim)] border border-[var(--color-border)] animate-pulse" />;
  }

  return (
    <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)]">
      <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Cost by Feature</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical" margin={{ right: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            tickFormatter={(v: number) => `$${v.toFixed(2)}`}
            axisLine={{ stroke: 'var(--color-border)' }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="feature"
            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            width={100}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
            formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(4)}`, 'Cost']}
          />
          <Bar dataKey="cost_usd" fill="var(--color-primary)" radius={[0, 6, 6, 0]} barSize={28}>
            <LabelList
              dataKey="cost_usd"
              position="right"
              formatter={(v) => `$${Number(v ?? 0).toFixed(2)}`}
              style={{ fontSize: 11, fill: 'var(--color-text-muted)', fontWeight: 500 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
