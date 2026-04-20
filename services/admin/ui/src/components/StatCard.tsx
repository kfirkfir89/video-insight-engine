import type { ReactNode } from 'react';
import { Panel } from './Panel';

export type StatTone = 'primary' | 'success' | 'warning' | 'danger' | 'accent' | 'neutral';
export type StatSize = 'sm' | 'md';
export type TrendDirection = 'up' | 'down' | 'flat';

interface Trend {
  direction: TrendDirection;
  label?: string;
}

interface StatCardProps {
  label: ReactNode;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  tone?: StatTone;
  size?: StatSize;
  trend?: Trend;
  className?: string;
}

const TONE_VAR: Record<Exclude<StatTone, 'neutral'>, { fg: string; soft: string }> = {
  primary: { fg: 'var(--color-primary)', soft: 'var(--color-primary-soft)' },
  success: { fg: 'var(--color-success)', soft: 'var(--color-success-soft)' },
  warning: { fg: 'var(--color-warning)', soft: 'var(--color-warning-soft)' },
  danger: { fg: 'var(--color-danger)', soft: 'var(--color-danger-soft)' },
  accent: { fg: 'var(--color-accent)', soft: 'var(--color-accent-soft)' },
};

const TREND_COLOR: Record<TrendDirection, string> = {
  up: 'var(--color-success)',
  down: 'var(--color-danger)',
  flat: 'var(--color-text-muted)',
};

function TrendIcon({ direction }: { direction: TrendDirection }) {
  if (direction === 'up') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="17 6 23 6 23 12" />
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      </svg>
    );
  }
  if (direction === 'down') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="17 18 23 18 23 12" />
        <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  size = 'md',
  trend,
  className,
}: StatCardProps) {
  const toneColors = tone === 'neutral' ? null : TONE_VAR[tone];
  const valueClass = size === 'sm' ? 'text-xl' : 'text-2xl';

  return (
    <Panel tone="raised" padding="md" className={className}>
      <div className="flex items-center gap-2 mb-1.5" data-slot="statcard-header">
        {icon !== undefined && (
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md"
            style={
              toneColors
                ? { background: toneColors.soft, color: toneColors.fg }
                : {
                    background: 'var(--color-surface-dim)',
                    color: 'var(--color-text-muted)',
                  }
            }
            data-slot="statcard-icon"
            data-tone={tone}
          >
            {icon}
          </span>
        )}
        <div className="text-xs font-medium text-[var(--color-text-muted)]" data-slot="statcard-label">
          {label}
        </div>
      </div>
      <p
        className={`${valueClass} font-semibold tabular-nums text-[var(--color-text)]`}
        data-slot="statcard-value"
        data-size={size}
      >
        {value}
      </p>
      {hint !== undefined && (
        <p className="text-[11px] text-[var(--color-text-faint)] mt-0.5" data-slot="statcard-hint">
          {hint}
        </p>
      )}
      {trend !== undefined && (
        <div
          className="flex items-center gap-1 mt-1 text-[11px] font-medium"
          style={{ color: TREND_COLOR[trend.direction] }}
          data-slot="statcard-trend"
          data-direction={trend.direction}
        >
          <TrendIcon direction={trend.direction} />
          {trend.label !== undefined && <span>{trend.label}</span>}
        </div>
      )}
    </Panel>
  );
}
