import { memo } from 'react';
import { cn } from '@/lib/utils';

interface OptionGridProps {
  options: string[];
  selectedIndex?: number;
  correctIndex?: number;
  onSelect: (index: number) => void;
  className?: string;
}

/**
 * Grid of selectable options. Pure CSS transitions + keyframes for reveal states.
 */
export const OptionGrid = memo(function OptionGrid({
  options,
  selectedIndex,
  correctIndex,
  onSelect,
  className,
}: OptionGridProps) {
  const revealed = selectedIndex != null && correctIndex != null;

  return (
    <div
      className={cn(
        'grid gap-2',
        options.length <= 2 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2',
        className,
      )}
    >
      {options.map((option, i) => {
        const isSelected = i === selectedIndex;
        const isCorrect = i === correctIndex;
        const showCorrect = revealed && isCorrect;
        const showWrong = revealed && isSelected && !isCorrect;
        const isDimmed = revealed && !showCorrect && !showWrong;

        return (
          <button
            key={i}
            onClick={() => onSelect(i)}
            disabled={revealed}
            style={{ animationDelay: `${i * 50}ms` }}
            className={cn(
              'relative overflow-hidden rounded-xl border px-3 py-3 sm:px-4 sm:py-3.5 text-[0.9375rem] font-medium leading-snug tracking-[-0.005em] text-balance text-start animate-fade-up min-h-11',
              'transition-[transform,box-shadow,opacity,background-color,border-color] duration-200 ease-[var(--ease-out-expo)]',
              !revealed &&
                'border-border/60 bg-muted/20 hover:bg-muted/40 hover:border-border hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100',
              showCorrect &&
                'border-success bg-[oklch(from_var(--success)_l_c_h_/_0.12)] text-success ring-2 ring-success shadow-[0_0_28px_-4px_var(--success)] scale-pulse-once vie-shimmer',
              showWrong &&
                'border-destructive bg-[oklch(from_var(--destructive)_l_c_h_/_0.1)] text-destructive ring-2 ring-destructive animate-[shake_0.45s_ease-in-out_both]',
              isDimmed && 'opacity-45',
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
});
