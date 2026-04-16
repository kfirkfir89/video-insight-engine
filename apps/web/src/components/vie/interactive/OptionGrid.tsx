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
 * Grid of selectable options (quiz answers, scenario choices, etc.).
 * Domain-free: just strings and indices.
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
    <div className={cn('grid gap-2', options.length <= 2 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2', className)}>
      {options.map((option, i) => {
        const isSelected = i === selectedIndex;
        const isCorrect = i === correctIndex;
        const showCorrect = revealed && isCorrect;
        const showWrong = revealed && isSelected && !isCorrect;

        return (
          <button
            key={i}
            onClick={() => onSelect(i)}
            disabled={revealed}
            className={cn(
              'rounded-xl border px-4 py-3.5 text-[0.9375rem] font-medium leading-snug tracking-[-0.005em] text-balance text-start transition-all duration-200',
              !revealed && 'border-border/50 bg-muted/20 hover:bg-muted/40 hover:-translate-y-0.5 hover:shadow-md hover:border-border',
              showCorrect && 'border-success bg-success/10 text-success ring-2 ring-success shadow-[0_0_20px_-4px_var(--success)]',
              showWrong && 'border-destructive bg-destructive/10 text-destructive ring-2 ring-destructive',
              revealed && !showCorrect && !showWrong && 'opacity-50',
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
});
