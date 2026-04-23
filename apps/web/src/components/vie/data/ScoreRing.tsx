import { memo, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useCountUp } from '@/hooks/use-count-up';

interface ScoreRingProps {
  score: number;
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

/**
 * SVG ring with stroke-dashoffset CSS transition, count-up numeric,
 * orbital marker dot, and completion flash. No motion runtime.
 */
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

  // Under reduced-motion, skip the rAF fade-in so the ring shows its final
  // state from first paint. Also ensures tests see the target value
  // synchronously without needing waitFor.
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    // Guard the `.matches` read — matchMedia itself is optional-chained, but
    // an undefined return would throw on the subsequent property access.
    return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  });
  const [completed, setCompleted] = useState<boolean>(false);
  const hasFlashedRef = useRef<boolean>(false);

  useEffect(() => {
    if (visible) return;
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  const displayedScore = useCountUp(visible ? clampedScore : 0, {
    duration: 1100,
    enabled: visible,
    onComplete: () => {
      if (!hasFlashedRef.current && percentage >= 0.8) {
        setCompleted(true);
        hasFlashedRef.current = true;
      }
    },
  });

  const resolvedColor = color ?? (() => {
    if (percentage >= 0.75) return 'var(--success)';
    if (percentage >= 0.5) return 'var(--warning)';
    return 'var(--destructive)';
  })();

  const displayValue = (() => {
    if (total === 100) return `${Math.round(displayedScore)}%`;
    if (total === 10) return displayedScore.toFixed(1);
    return `${Math.round(displayedScore)}/${total}`;
  })();

  // Stable aria-label from the target value — screen readers shouldn't
  // re-announce mid-count-up on every frame.
  const ariaValue = (() => {
    if (total === 100) return `${Math.round(clampedScore)}%`;
    if (total === 10) return clampedScore.toFixed(1);
    return `${clampedScore}/${total}`;
  })();

  const center = config.px / 2;
  const offset = circumference * (1 - percentage);

  return (
    <div
      className={cn('relative inline-flex flex-col items-center gap-1 animate-fade-up', className)}
      role="img"
      aria-label={`Score: ${ariaValue}${label ? ` — ${label}` : ''}`}
    >
      <div className="relative" style={{ width: config.px, height: config.px }}>
        <svg
          width={config.px}
          height={config.px}
          viewBox={`0 0 ${config.px} ${config.px}`}
          className="absolute inset-0 -rotate-90 transition-[filter] duration-500 ease-out"
          style={{ filter: completed ? `drop-shadow(0 0 16px ${resolvedColor})` : undefined }}
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={config.stroke}
            opacity={0.25}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={resolvedColor}
            strokeWidth={config.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={visible ? offset : circumference}
            style={{
              transition: 'stroke-dashoffset 1100ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </svg>

        {/* Orbital marker dot riding the ring's leading edge */}
        {visible && percentage > 0.02 && (
          <span
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              transform: `rotate(${percentage * 360}deg)`,
              transformOrigin: '50% 50%',
              transition: 'transform 1100ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <span
              className="absolute"
              style={{
                left: center - 4,
                top: config.stroke - 4,
                width: 8,
                height: 8,
                borderRadius: '9999px',
                backgroundColor: resolvedColor,
                boxShadow: `0 0 10px ${resolvedColor}`,
              }}
            />
          </span>
        )}

        {/* Completion flash ring — one-shot keyframe triggered by class */}
        {completed && (
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full animate-[pulse-ring_0.9s_ease-out_both]"
            style={{
              border: `2px solid ${resolvedColor}`,
              boxShadow: `0 0 30px ${resolvedColor}`,
            }}
          />
        )}

        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn('vie-count-up font-semibold tracking-tight', config.fontSize)}
            style={{ color: resolvedColor }}
          >
            {displayValue}
          </span>
        </div>
      </div>

      {label && (
        <span className={cn('font-medium uppercase tracking-wider text-muted-foreground', config.labelSize)}>
          {label}
        </span>
      )}
    </div>
  );
});
