import { memo } from 'react';
import { cn } from '@/lib/utils';

interface StepperProps {
  total: number;
  current: number;
  completedSteps?: Set<number>;
  onStepClick?: (index: number) => void;
  className?: string;
}

/**
 * Dot/step indicator for multi-step flows.
 * Shows progress through a sequence.
 */
export const Stepper = memo(function Stepper({
  total,
  current,
  completedSteps,
  onStepClick,
  className,
}: StepperProps) {
  return (
    <div className={cn('flex items-center justify-center gap-1.5', className)} aria-label="Step progress">
      {Array.from({ length: total }, (_, i) => {
        const isCurrent = i === current;
        const isCompleted = completedSteps?.has(i);
        return (
          <button
            key={i}
            onClick={() => onStepClick?.(i)}
            disabled={!onStepClick}
            className={cn(
              'w-2.5 h-2.5 rounded-full transition-all duration-200',
              isCurrent && 'bg-primary scale-125',
              isCompleted && !isCurrent && 'bg-success/60',
              !isCurrent && !isCompleted && 'bg-muted-foreground/20',
              onStepClick && 'cursor-pointer hover:scale-110',
              !onStepClick && 'cursor-default',
            )}
            aria-label={`Step ${i + 1}${isCurrent ? ' (current)' : ''}${isCompleted ? ' (completed)' : ''}`}
          />
        );
      })}
    </div>
  );
});
