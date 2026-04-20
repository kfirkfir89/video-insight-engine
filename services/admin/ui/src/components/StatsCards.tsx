import type { ReactNode } from 'react';
import { useUsageStats } from '../hooks/use-admin-api';
import { DollarIcon, ZapIcon, ClockIcon, CheckCircleIcon, CoinsIcon } from './icons';
import { StatCard } from './StatCard';
import type { StatTone } from './StatCard';
import { SkeletonPanel } from './SkeletonPanel';
import { ErrorState } from './ErrorState';
import { InfoTip } from './InfoTip';

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const fmtUsd = (n: number) => `$${n.toFixed(4)}`;

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function LabelWithTip({ label, tip }: { label: string; tip?: ReactNode }) {
  if (tip === undefined) return <>{label}</>;
  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <InfoTip label={`${label} explanation`}>{tip}</InfoTip>
    </span>
  );
}

interface CardDef {
  label: string;
  value: string;
  icon: typeof DollarIcon;
  tone: StatTone;
  tip?: ReactNode;
}

export function StatsCards({ days = 30 }: { days?: number }) {
  const { data, isLoading, isError, error, refetch } = useUsageStats(days);

  if (isError) {
    return (
      <div data-testid="stats-cards">
        <ErrorState error={error} onRetry={() => refetch()} title="Failed to load summary stats" />
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4" data-testid="stats-cards">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonPanel key={i} size="md" />
        ))}
      </div>
    );
  }

  const successRate = data.total_calls
    ? `${((data.success_count / data.total_calls) * 100).toFixed(1)}%`
    : 'N/A';

  const cards: CardDef[] = [
    {
      label: 'Total Cost',
      value: fmtUsd(data.total_cost_usd ?? 0),
      icon: DollarIcon,
      tone: 'primary',
    },
    {
      label: 'Total Calls',
      value: fmt(data.total_calls ?? 0),
      icon: ZapIcon,
      tone: 'success',
    },
    {
      label: 'Avg Duration',
      value: `${fmt(data.avg_duration_ms ?? 0)}ms`,
      icon: ClockIcon,
      tone: 'warning',
      tip: 'Wall-clock time per LLM call from request start to response complete.',
    },
    {
      label: 'Success Rate',
      value: successRate,
      icon: CheckCircleIcon,
      tone: 'success',
      tip: 'Successful calls / total calls. A call is successful when the LLM returned a response without error.',
    },
    {
      label: 'Total Tokens',
      value: fmtTokens(data.total_tokens ?? 0),
      icon: CoinsIcon,
      tone: 'accent',
      tip: 'Sum of input + output tokens across all calls in the selected window.',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4" data-testid="stats-cards">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <StatCard
            key={c.label}
            label={<LabelWithTip label={c.label} tip={c.tip} />}
            value={c.value}
            tone={c.tone}
            icon={<Icon />}
          />
        );
      })}
    </div>
  );
}
