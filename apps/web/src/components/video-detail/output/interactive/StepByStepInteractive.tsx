import { memo, useState, useMemo } from 'react';
import { Check, Clock, AlertTriangle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { GlassCard } from '../GlassCard';
import { Celebration } from '../Celebration';
import { CrossTabLink } from '../CrossTabLink';
import type { StepItem } from '@vie/types';

interface StepByStepInteractiveProps {
  steps: StepItem[];
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

const STEP_COLORS = [
  'border-primary/50 text-primary',
  'border-info/50 text-info',
  'border-success/50 text-success',
] as const;

export const StepByStepInteractive = memo(function StepByStepInteractive({
  steps,
  nextTab,
  onNavigateTab,
}: StepByStepInteractiveProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const progress = useMemo(
    () => (steps.length > 0 ? (completedSteps.size / steps.length) * 100 : 0),
    [completedSteps.size, steps.length],
  );

  const allDone = completedSteps.size === steps.length && steps.length > 0;

  const toggleComplete = (index: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
        // Auto-advance to next incomplete step
        const nextIncomplete = steps.findIndex((_, i) => i > index && !next.has(i));
        if (nextIncomplete !== -1) setCurrentStep(nextIncomplete);
      }
      return next;
    });
  };

  if (steps.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{completedSteps.size}/{steps.length} steps</span>
        </div>
        <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step list */}
      <div className="space-y-3">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isDone = completedSteps.has(index);
          const colorClass = STEP_COLORS[index % STEP_COLORS.length];

          return (
            <GlassCard
              key={step.number}
              variant={isActive ? 'interactive' : 'default'}
              className={cn(
                'cursor-pointer transition-all duration-200',
                isActive && 'border-primary/40',
                isDone && 'opacity-60',
              )}
            >
              <div
                className="flex gap-3"
                onClick={() => setCurrentStep(index)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setCurrentStep(index)}
              >
                {/* Number circle / check */}
                <div
                  className={cn(
                    'shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all',
                    isDone ? 'bg-success border-success text-white' : colorClass,
                  )}
                >
                  {isDone ? <Check className="h-4 w-4" /> : step.number}
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  {step.title && (
                    <h4 className={cn('text-sm font-medium', isDone && 'line-through')}>
                      {step.title}
                    </h4>
                  )}
                  <p className={cn('text-sm text-muted-foreground', isDone && 'line-through')}>
                    {step.instruction}
                  </p>

                  <div className="flex items-center gap-3 flex-wrap">
                    {step.duration && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/70 bg-muted/50 px-2 py-0.5 rounded">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {step.duration}
                      </span>
                    )}
                  </div>

                  {step.tips && isActive && (
                    <div className="flex items-start gap-1.5 text-xs text-info bg-info/5 rounded-md px-2.5 py-1.5 mt-1">
                      <Lightbulb className="h-3 w-3 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{step.tips}</span>
                    </div>
                  )}

                  {step.safetyNote && isActive && (
                    <div className="flex items-start gap-1.5 text-xs text-warning bg-warning-soft rounded-md px-2.5 py-1.5 mt-1">
                      <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{step.safetyNote}</span>
                    </div>
                  )}
                </div>

                {/* Complete button */}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => { e.stopPropagation(); toggleComplete(index); }}
                  className={cn(
                    'shrink-0 rounded-full',
                    isDone && 'text-success hover:text-success',
                  )}
                  aria-label={isDone ? `Mark step ${step.number} incomplete` : `Mark step ${step.number} complete`}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {allDone && (
        <Celebration
          emoji="🎉"
          title="All steps complete!"
          subtitle="Great job following through."
          nextTabId={nextTab}
          nextLabel={nextTab ? 'Continue' : undefined}
          onNavigateTab={onNavigateTab}
        />
      )}

      {!allDone && nextTab && onNavigateTab && (
        <CrossTabLink tabId={nextTab} label="Next section" onNavigate={onNavigateTab} />
      )}
    </div>
  );
});
