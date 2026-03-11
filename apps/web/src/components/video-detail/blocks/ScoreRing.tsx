import { memo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ScoreRingProps {
  score: number;
  maxScore?: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

const SIZE_CONFIG = {
  sm: { px: 64, stroke: 5, fontSize: 'text-sm', labelSize: 'text-[10px]' },
  md: { px: 96, stroke: 6, fontSize: 'text-xl', labelSize: 'text-xs' },
  lg: { px: 128, stroke: 7, fontSize: 'text-2xl', labelSize: 'text-sm' },
} as const;

/**
 * Animated SVG score ring with stroke-dashoffset transition on mount.
 * Display modes: percentage (maxScore=100), rating (maxScore=10), fraction (X/Y).
 */
export const ScoreRing = memo(function ScoreRing({
  score,
  maxScore = 100,
  label,
  size = 'md',
  color,
}: ScoreRingProps) {
  const config = SIZE_CONFIG[size];
  const radius = (config.px - config.stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(score, maxScore));
  const percentage = maxScore > 0 ? clampedScore / maxScore : 0;
  const offset = circumference * (1 - percentage);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger animation on mount
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const strokeColor = color || 'var(--primary)';

  // Display mode
  const displayValue = (() => {
    if (maxScore === 100) return `${Math.round(clampedScore)}%`;
    if (maxScore === 10) return clampedScore.toFixed(1);
    return `${clampedScore}/${maxScore}`;
  })();

  const center = config.px / 2;

  return (
    <div
      className="inline-flex flex-col items-center gap-1"
      role="img"
      aria-label={`Score: ${displayValue}${label ? ` — ${label}` : ''}`}
    >
      <svg
        width={config.px}
        height={config.px}
        viewBox={`0 0 ${config.px} ${config.px}`}
        className="transform -rotate-90"
      >
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={config.stroke}
          opacity={0.3}
        />
        {/* Score arc */}
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
          style={{
            transition: 'stroke-dashoffset 0.6s ease-out',
          }}
        />
      </svg>

      {/* Centered score */}
      <div
        className="flex items-center justify-center"
        style={{
          width: config.px,
          height: config.px,
          marginTop: -config.px,
        }}
      >
        <span className={cn('font-bold tabular-nums', config.fontSize)}>
          {displayValue}
        </span>
      </div>

      {/* Label below */}
      {label && (
        <span className={cn('text-muted-foreground', config.labelSize)}>
          {label}
        </span>
      )}
    </div>
  );
});
