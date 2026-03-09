import { memo, useState } from 'react';
import { Check, Clock, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { formatDurationHuman } from '@/lib/string-utils';
import { BlockWrapper } from './BlockWrapper';
import type { StepBlock as StepBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

const STEP_COLORS = ['border-primary/40 text-primary', 'border-info/40 text-info', 'border-success/40 text-success'] as const;

interface StepBlockProps {
  block: StepBlockType;
  /** Simple mode: non-interactive numbered circles, no duration/tips */
  simple?: boolean;
}

/**
 * Renders numbered recipe/process steps with optional timer integration.
 * Simple mode renders non-interactive numbered circles without duration/tips.
 */
export const StepBlock = memo(function StepBlock({ block, simple }: StepBlockProps) {
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

  // Simple mode: non-interactive numbered items without duration/tips
  if (simple) {
    return (
      <BlockWrapper blockId={block.blockId} variant="inline">
        <ol className="space-y-0 stagger-children">
          {steps.map((step, stepIndex) => (
            <li key={step.number}>
              {stepIndex > 0 && <div className="fade-divider my-1" aria-hidden="true" />}
              <div className="relative pl-10 text-sm min-h-[2rem]">
                <span className="numbered-ghost" aria-hidden="true">{step.number}</span>
                <span
                  className="absolute left-0 top-0.5 w-6 h-6 rounded-full border-2 border-primary/40 text-primary/90 flex items-center justify-center text-xs font-bold"
                  aria-hidden="true"
                >
                  {step.number}
                </span>
                <span className="text-muted-foreground leading-relaxed">
                  {step.instruction}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </BlockWrapper>
    );
  }

  return (
    <BlockWrapper
      blockId={block.blockId}
      label={BLOCK_LABELS.steps}
      variant="card"
      headerIcon={<Timer className="h-4 w-4" />}
      headerLabel="Steps"
    >
      <div className="space-y-0">
        <ol className="space-y-0 stagger-children">
          {steps.map((step, stepIndex) => {
            const isCompleted = completedSteps.has(step.number);
            const colorClass = STEP_COLORS[stepIndex % STEP_COLORS.length];

            return (
              <li key={step.number}>
                {stepIndex > 0 && <div className="fade-divider my-1.5" aria-hidden="true" />}
                <div
                  className={cn(
                    'step-connector flex gap-3 transition-opacity',
                    isCompleted && 'opacity-60'
                  )}
                >
                <Button
                  variant="ghost"
                  size="icon-bare"
                  onClick={() => toggleStep(step.number)}
                  className={cn(
                    'shrink-0 w-7 h-7 rounded-full border-2 text-sm font-medium transition-all duration-200 z-10',
                    isCompleted
                      ? 'bg-success border-success text-white'
                      : colorClass
                  )}
                  aria-label={isCompleted ? `Mark step ${step.number} incomplete` : `Mark step ${step.number} complete`}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    step.number
                  )}
                </Button>

                <div className={cn('flex-1 space-y-1', isCompleted && 'line-through')}>
                  <p className="text-sm text-muted-foreground">{step.instruction}</p>

                  <div className="flex items-center gap-3 flex-wrap">
                    {step.duration && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/70 bg-muted/50 px-2 py-0.5 rounded">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {formatDurationHuman(step.duration)}
                      </span>
                    )}
                    {step.tips && (
                      <span className="text-xs text-muted-foreground/70 italic">
                        Tip: {step.tips}
                      </span>
                    )}
                  </div>
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
