import { PieChart, Pie, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useUsageByOutputType } from '../hooks/use-admin-api';
import { getOutputTypeLabel } from '../lib/constants';
import { Panel } from './Panel';
import { SkeletonPanel } from './SkeletonPanel';
import { ErrorState } from './ErrorState';

const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
];

export function OutputTypeChart({ days = 30 }: { days?: number }) {
  const { data, isLoading, isError, error, refetch } = useUsageByOutputType(days);

  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} title="Failed to load output breakdown" />;
  }

  if (isLoading || !data) {
    return <SkeletonPanel size="xl" />;
  }

  if (data.length === 0) {
    return (
      <Panel title="Cost by Output Type" tone="raised" padding="md">
        <div className="h-60 flex items-center justify-center">
          <p className="text-sm text-[var(--color-text-faint)]">No output type data available</p>
        </div>
      </Panel>
    );
  }

  const colored = data.map((d, i) => ({
    ...d,
    label: getOutputTypeLabel(d.output_type),
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <Panel title="Cost by Output Type" tone="raised" padding="md">
      <div data-testid="output-type-chart">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={colored}
              dataKey="cost_usd"
              nameKey="label"
              cx="50%"
              cy="50%"
              outerRadius={90}
              innerRadius={40}
              paddingAngle={2}
              label={({ name }: { name?: string }) => name ?? ''}
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
    </Panel>
  );
}
