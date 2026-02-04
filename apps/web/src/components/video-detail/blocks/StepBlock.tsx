import { memo, useState } from 'react';
import { Check, Clock, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockWrapper } from './BlockWrapper';
import type { StepBlock as StepBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface StepBlockProps {
  block: StepBlockType;
}

/**
 * Renders numbered recipe/process steps with optional timer integration.
 */
export const StepBlock = memo(function StepBlock({ block }: StepBlockProps) {
  const steps = block.steps ?? [];
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  if (steps.length === 0) return null;

  const toggleStep = (stepNumber: number) => {
    setCompletedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepNumber)) {
        next.delete(stepNumber);
      } else {
        next.add(stepNumber);
      }
      return next;
    });
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  return (
    <BlockWrapper
      blockId={block.blockId}
      label={BLOCK_LABELS.steps}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
          <Timer className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{BLOCK_LABELS.steps}</span>
        </div>

        <ol className="space-y-4">
          {steps.map((step) => {
            const isCompleted = completedSteps.has(step.number);

            return (
              <li
                key={step.number}
                className={cn(
                  'flex gap-3 transition-opacity',
                  isCompleted && 'opacity-60'
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleStep(step.number)}
                  className={cn(
                    'shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                    isCompleted
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-[var(--category-accent,currentColor)]/40 text-[var(--category-accent,currentColor)]'
                  )}
                  aria-label={isCompleted ? `Mark step ${step.number} incomplete` : `Mark step ${step.number} complete`}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    step.number
                  )}
                </button>

                <div className={cn('flex-1 space-y-1', isCompleted && 'line-through')}>
                  <p className="text-sm text-muted-foreground">{step.instruction}</p>

                  <div className="flex items-center gap-3 flex-wrap">
                    {step.duration && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/70 bg-muted/50 px-2 py-0.5 rounded">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {formatDuration(step.duration)}
                      </span>
                    )}
                    {step.tips && (
                      <span className="text-xs text-muted-foreground/60 italic">
                        Tip: {step.tips}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </BlockWrapper>
  );
});
