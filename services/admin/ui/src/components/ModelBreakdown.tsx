import { PieChart, Pie, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useUsageByModel } from '../hooks/use-admin-api';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export function ModelBreakdown({ days = 30 }: { days?: number }) {
  const { data, isLoading } = useUsageByModel(days);

  if (isLoading || !data) {
    return <div className="h-64 rounded-xl bg-[var(--color-surface-dim)] border border-[var(--color-border)] animate-pulse" />;
  }

  const colored = data.map((d, i) => ({ ...d, fill: COLORS[i % COLORS.length] }));

  return (
    <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dim)]">
      <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Cost by Model</h3>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={colored}
            dataKey="cost_usd"
            nameKey="model"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({ name }: { name?: string }) => name?.split('/').pop() ?? ''}
          />
          <Tooltip
            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
            formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(4)}`, 'Cost']}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
