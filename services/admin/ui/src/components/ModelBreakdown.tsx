import { PieChart, Pie, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useUsageByModel } from '../hooks/use-admin-api';

const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
];

export function ModelBreakdown({ days = 30 }: { days?: number }) {
  const { data, isLoading } = useUsageByModel(days);

  if (isLoading || !data) {
    return <div className="h-72 rounded-xl bg-[var(--color-surface-dim)] border border-[var(--color-border)] animate-pulse" />;
  }

  const colored = data.map((d, i) => ({ ...d, fill: COLORS[i % COLORS.length] }));

  return (
    <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)]">
      <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Cost by Model</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={colored}
            dataKey="cost_usd"
            nameKey="model"
            cx="50%"
            cy="50%"
            outerRadius={90}
            innerRadius={40}
            paddingAngle={2}
            label={({ name }: { name?: string }) => name?.split('/').pop()?.split('-').slice(0, 2).join('-') ?? ''}
            labelLine={{ stroke: 'var(--color-text-faint)', strokeWidth: 1 }}
          />
          <Tooltip
            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
            formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(4)}`, 'Cost']}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value: string) => <span style={{ color: 'var(--color-text-muted)' }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
