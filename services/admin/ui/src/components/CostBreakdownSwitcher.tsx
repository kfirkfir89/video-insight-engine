import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import {
  useUsageByModel,
  useUsageByFeature,
  useUsageByOutputType,
} from '../hooks/use-admin-api';
import { getOutputTypeLabel } from '../lib/constants';
import { Panel } from './Panel';
import { SkeletonPanel } from './SkeletonPanel';
import { ErrorState } from './ErrorState';

type View = 'model' | 'feature' | 'output';

interface ViewMeta {
  id: View;
  label: string;
}

const VIEWS: ViewMeta[] = [
  { id: 'model', label: 'By model' },
  { id: 'feature', label: 'By feature' },
  { id: 'output', label: 'By output' },
];

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

const TOP_N = 8;

interface NormalizedRow {
  name: string;
  cost_usd: number;
  calls: number;
}

function shortenModelName(raw: string): string {
  const tail = raw.split('/').pop() ?? raw;
  const segments = tail.split('-');
  return segments.slice(0, 3).join('-');
}

function normalize(rows: NormalizedRow[]): NormalizedRow[] {
  const sorted = [...rows].sort((a, b) => b.cost_usd - a.cost_usd);
  if (sorted.length <= TOP_N) return sorted;
  const top = sorted.slice(0, TOP_N);
  const rest = sorted.slice(TOP_N);
  const other: NormalizedRow = {
    name: 'Other',
    cost_usd: rest.reduce((s, r) => s + (r.cost_usd ?? 0), 0),
    calls: rest.reduce((s, r) => s + (r.calls ?? 0), 0),
  };
  return [...top, other];
}

interface SegmentedProps {
  value: View;
  onChange: (v: View) => void;
}

function SegmentedControl({ value, onChange }: SegmentedProps) {
  return (
    <div
      role="tablist"
      aria-label="Cost breakdown view"
      className="inline-flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-dim)] p-0.5"
      data-slot="cost-breakdown-toggle"
    >
      {VIEWS.map((view) => {
        const active = view.id === value;
        return (
          <button
            key={view.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(view.id)}
            data-view={view.id}
            data-active={active}
            className={[
              'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
              active
                ? 'bg-[var(--color-surface-raised)] text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
            ].join(' ')}
          >
            {view.label}
          </button>
        );
      })}
    </div>
  );
}

interface ChartProps {
  rows: NormalizedRow[];
}

function BreakdownChart({ rows }: ChartProps) {
  if (rows.length === 0) {
    return (
      <div
        className="h-80 flex items-center justify-center"
        data-testid="cost-breakdown-empty"
      >
        <p className="text-sm text-[var(--color-text-faint)]">No cost data for this view</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={rows} layout="vertical" margin={{ right: 56, left: 8 }}>
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
          dataKey="name"
          tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
          width={140}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(4)}`, 'Cost']}
        />
        <Bar dataKey="cost_usd" radius={[0, 6, 6, 0]} barSize={22}>
          {rows.map((row, i) => (
            <Cell key={row.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
          <LabelList
            dataKey="cost_usd"
            position="right"
            formatter={(v) => `$${Number(v ?? 0).toFixed(2)}`}
            style={{ fontSize: 11, fill: 'var(--color-text-muted)', fontWeight: 500 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

interface CostBreakdownSwitcherProps {
  days?: number;
}

export function CostBreakdownSwitcher({ days = 30 }: CostBreakdownSwitcherProps) {
  const [view, setView] = useState<View>('model');

  const modelQuery = useUsageByModel(days, { enabled: view === 'model' });
  const featureQuery = useUsageByFeature(days, { enabled: view === 'feature' });
  const outputQuery = useUsageByOutputType(days, { enabled: view === 'output' });

  const activeQuery =
    view === 'model' ? modelQuery : view === 'feature' ? featureQuery : outputQuery;

  const rows = useMemo<NormalizedRow[]>(() => {
    if (view === 'model') {
      const data = modelQuery.data ?? [];
      return normalize(
        data.map((d) => ({
          name: shortenModelName(d.model),
          cost_usd: d.cost_usd ?? 0,
          calls: d.calls ?? 0,
        })),
      );
    }
    if (view === 'feature') {
      const data = featureQuery.data ?? [];
      return normalize(
        data.map((d) => ({
          name: d.feature,
          cost_usd: d.cost_usd ?? 0,
          calls: d.calls ?? 0,
        })),
      );
    }
    const data = outputQuery.data ?? [];
    return normalize(
      data.map((d) => ({
        name: getOutputTypeLabel(d.output_type),
        cost_usd: d.cost_usd ?? 0,
        calls: d.calls ?? 0,
      })),
    );
  }, [view, modelQuery.data, featureQuery.data, outputQuery.data]);

  const header = (
    <div className="flex items-center gap-1.5">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="text-[var(--color-text-muted)]"
      >
        <line x1="12" y1="20" x2="12" y2="10" />
        <line x1="18" y1="20" x2="18" y2="4" />
        <line x1="6" y1="20" x2="6" y2="16" />
      </svg>
      <span>Cost breakdown</span>
    </div>
  );

  return (
    <Panel
      title={header}
      actions={<SegmentedControl value={view} onChange={setView} />}
      tone="raised"
      padding="md"
      className="cost-breakdown-switcher"
    >
      <div data-testid="cost-breakdown-body" data-view={view}>
        {activeQuery.isLoading && <SkeletonPanel size="lg" />}
        {!activeQuery.isLoading && activeQuery.isError && (
          <ErrorState
            error={activeQuery.error}
            title="Failed to load breakdown"
            compact
            onRetry={() => activeQuery.refetch()}
          />
        )}
        {!activeQuery.isLoading && !activeQuery.isError && <BreakdownChart rows={rows} />}
      </div>
    </Panel>
  );
}
