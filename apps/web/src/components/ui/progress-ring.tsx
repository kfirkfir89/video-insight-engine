import { memo } from 'react';
import { cn } from '@/lib/utils';

export interface ProgressRingProps {
  /** Progress value (0-100) */
  value: number;
  /** Ring size in pixels */
  size?: number;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Ring color */
  color?: string;
  /** Background ring color */
  bgColor?: string;
  /** Show percentage text in center */
  showValue?: boolean;
  /** Custom class name */
  className?: string;
  /** Accessible label */
  label?: string;
}

/**
 * Circular progress indicator using SVG.
 */
export const ProgressRing = memo(function ProgressRing({
  value,
  size = 48,
  strokeWidth = 4,
  color = 'currentColor',
  bgColor = 'currentColor',
  showValue = false,
  className,
  label,
}: ProgressRingProps) {
  // Clamp value between 0 and 100
  const clampedValue = Math.max(0, Math.min(100, value));

  // Calculate circle properties
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (clampedValue / 100) * circumference;

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? `${clampedValue}% complete`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
          className="opacity-20"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-300 ease-out"
        />
      </svg>

      {showValue && (
        <span className="absolute text-xs font-medium tabular-nums">
          {Math.round(clampedValue)}%
        </span>
      )}
    </div>
  );
});
