import { memo } from 'react';
import { cn } from '@/lib/utils';

interface StepperProps {
  total: number;
  current: number;
  completedSteps?: Set<number>;
  onStepClick?: (index: number) => void;
  className?: string;
}

export const Stepper = memo(function Stepper({
  total,
  current,
  completedSteps,
  onStepClick,
  className,
}: StepperProps) {
  return (
    <div className={cn('flex items-center justify-center gap-2', className)} aria-label="Step progress">
      {Array.from({ length: total }, (_, i) => {
        const isCurrent = i === current;
        const isCompleted = completedSteps?.has(i);
        return (
          <button
            key={i}
            onClick={() => onStepClick?.(i)}
            disabled={!onStepClick}
            className={cn(
              'relative w-2.5 h-2.5 rounded-full transition-[transform,background-color,box-shadow] duration-300 ease-[var(--ease-out-expo)]',
              isCurrent
                ? 'bg-primary scale-[1.3] shadow-[0_0_12px_oklch(from_var(--primary)_l_c_h_/_0.7)]'
                : isCompleted
                  ? 'bg-[oklch(from_var(--success)_l_c_h_/_0.7)]'
                  : 'bg-[oklch(from_var(--muted-foreground)_l_c_h_/_0.25)]',
              onStepClick && 'cursor-pointer hover:scale-[1.2]',
              !onStepClick && 'cursor-default',
            )}
            aria-label={`Step ${i + 1}${isCurrent ? ' (current)' : ''}${isCompleted ? ' (completed)' : ''}`}
          >
            {isCurrent && (
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full border border-primary/50 animate-[pulse-ring_1.6s_ease-out_infinite]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
});
