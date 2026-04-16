import { memo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ScoreRingProps {
  score: number;
  /** Maximum score value (default 100) */
  total?: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
}

const SIZE_CONFIG = {
  sm: { px: 64, stroke: 5, fontSize: 'text-sm', labelSize: 'text-xs' },
  md: { px: 96, stroke: 6, fontSize: 'text-xl', labelSize: 'text-xs' },
  lg: { px: 128, stroke: 7, fontSize: 'text-2xl', labelSize: 'text-sm' },
} as const;

export const ScoreRing = memo(function ScoreRing({
  score,
  total = 100,
  label,
  size = 'md',
  color,
  className,
}: ScoreRingProps) {
  const config = SIZE_CONFIG[size];
  const radius = (config.px - config.stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(score, total));
  const percentage = total > 0 ? clampedScore / total : 0;
  const offset = circumference * (1 - percentage);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const resolvedColor = color ?? (() => {
    if (percentage >= 0.75) return 'var(--success)';
    if (percentage >= 0.5) return 'var(--warning)';
    return 'var(--destructive)';
  })();
  const strokeColor = resolvedColor;

  const displayValue = (() => {
    if (total === 100) return `${Math.round(clampedScore)}%`;
    if (total === 10) return clampedScore.toFixed(1);
    return `${clampedScore}/${total}`;
  })();

  const center = config.px / 2;

  return (
    <div
      className={cn('inline-flex flex-col items-center gap-1', className)}
      role="img"
      aria-label={`Score: ${displayValue}${label ? ` — ${label}` : ''}`}
    >
      <svg
        width={config.px}
        height={config.px}
        viewBox={`0 0 ${config.px} ${config.px}`}
        className="transform -rotate-90"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={config.stroke}
          opacity={0.3}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={config.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={mounted ? offset : circumference}
          style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
        />
      </svg>

      <div
        className="flex items-center justify-center"
        style={{ width: config.px, height: config.px, marginTop: -config.px }}
      >
        <span
          className={cn('font-semibold tabular-nums tracking-tight', config.fontSize)}
          style={{ color: resolvedColor }}
        >
          {displayValue}
        </span>
      </div>

      {label && (
        <span className={cn('font-medium uppercase tracking-wider text-muted-foreground', config.labelSize)}>
          {label}
        </span>
      )}
    </div>
  );
});
