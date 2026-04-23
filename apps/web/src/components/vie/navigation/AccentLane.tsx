import { memo } from 'react';
import { cn } from '@/lib/utils';

export type AccentLaneState =
  | 'idle'
  | 'hover'
  | 'selected'
  | 'drop-valid'
  | 'drop-invalid'
  | 'selection-mode';

interface AccentLaneProps {
  state: AccentLaneState;
  /** OKLCH color string; falls back to --primary when undefined. */
  color?: string;
  className?: string;
}

const STATE_BG: Record<AccentLaneState, string> = {
  idle: 'transparent',
  hover: 'oklch(from var(--accent-lane-color, var(--primary)) l c h / 0.35)',
  selected: 'var(--accent-lane-color, var(--primary))',
  'drop-valid': 'var(--accent-lane-color, var(--primary))',
  'drop-invalid': 'var(--muted-foreground)',
  'selection-mode': 'var(--primary)',
};

export const AccentLane = memo(function AccentLane({ state, color, className }: AccentLaneProps) {
  const style: React.CSSProperties = {
    backgroundColor: STATE_BG[state],
    ...(color ? ({ ['--accent-lane-color' as string]: color } as React.CSSProperties) : {}),
  };
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block w-[2px] self-stretch rounded-full shrink-0 transition-colors duration-[120ms] ease-[var(--ease-out-expo)]',
        className,
      )}
      style={style}
    />
  );
});
