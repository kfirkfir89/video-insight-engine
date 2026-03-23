import { memo, useState, useMemo } from 'react';
import { Check, AlertTriangle, Lightbulb, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { GlassCard, FadeIn, Timer, BackForward, Stepper, Timestamp, TextBlock } from '@/components/vie';
import { Celebration } from '../Celebration';

import { useTabState } from '@/contexts/TabStateContext';
import { useTabCoordination } from '../TabCoordinationContext';
import type { StepItem } from '@vie/types';

interface StepByStepInteractiveProps {
  steps: StepItem[];
  mode?: 'scrollable' | 'one_at_a_time';
  timers?: boolean;
  tabId?: string;
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
  onSeek?: (seconds: number) => void;
}

const STEP_COLORS = [
  'border-primary/50 text-primary',
  'border-info/50 text-info',
  'border-success/50 text-success',
] as const;

function parseDurationSeconds(duration?: string | number): number {
  if (duration == null) return 0;
  if (typeof duration === 'number') return duration;
  const match = duration.match(/(\d+)\s*(min|minute|m|sec|second|s|hr|hour|h)/i);
  if (!match) return 0;
  const val = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (unit.startsWith('h')) return val * 3600;
  if (unit.startsWith('m')) return val * 60;
  return val;
}

export const StepByStepInteractive = memo(function StepByStepInteractive({
  steps,
  mode = 'scrollable',
  timers,
  tabId = 'steps',
  nextTab,
  onNavigateTab,
  onSeek,
}: StepByStepInteractiveProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const tabState = useTabState();
  const tabCoord = useTabCoordination();

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
        tabState.uncompleteStep(index);
      } else {
        next.add(index);
        tabState.completeStep(index);
        const nextIncomplete = steps.findIndex((_, i) => i > index && !next.has(i));
        if (nextIncomplete !== -1) setCurrentStep(nextIncomplete);
      }
      // Check if all steps done
      if (next.size === steps.length && steps.length > 0) {
        tabCoord?.markTabCompleted(tabId);
      }
      return next;
    });
  };

  if (steps.length === 0) return null;

  // Default to one-at-a-time for manageable step counts
  const effectiveMode = mode ?? (steps.length <= 10 ? 'one_at_a_time' : 'scrollable');
  const isOneAtATime = effectiveMode === 'one_at_a_time';
  const visibleSteps = isOneAtATime ? [{ step: steps[currentStep], index: currentStep }] : steps.map((step, index) => ({ step, index }));

  return (
    <div className="space-y-4">
      {/* Step X of Y header for one-at-a-time */}
      {isOneAtATime && (
        <div className="text-center text-xs font-medium text-muted-foreground">
          Step {currentStep + 1} of {steps.length}
        </div>
      )}

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

      {/* One-at-a-time navigation */}
      {isOneAtATime && steps.length > 1 && (
        <BackForward
          onBack={() => setCurrentStep((p) => p - 1)}
          onForward={() => setCurrentStep((p) => p + 1)}
          backDisabled={currentStep === 0}
          forwardDisabled={currentStep === steps.length - 1}
        />
      )}

      {/* Step list */}
      <div className="space-y-3">
        {visibleSteps.map(({ step, index }, fadeIdx) => {
          if (!step) return null;
          const isActive = index === currentStep;
          const isDone = completedSteps.has(index);
          const colorClass = STEP_COLORS[index % STEP_COLORS.length];
          const durationSecs = parseDurationSeconds(step.duration);

          return (
            <FadeIn key={index} index={fadeIdx}>
              <GlassCard
                variant={isActive ? 'interactive' : 'default'}
                className={cn(
                  'cursor-pointer transition-all duration-200 overflow-hidden',
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
                    <p className={cn(
                      'text-sm text-muted-foreground',
                      isDone && 'line-through',
                      !isActive && 'line-clamp-2',
                    )}>
                      {step.instruction}
                    </p>

                    {/* Show more toggle for collapsed steps */}
                    {!isActive && step.instruction && step.instruction.length > 100 && (
                      <span className="text-xs text-primary">Show more</span>
                    )}

                    <div className="flex items-center gap-3 flex-wrap">
                      {step.duration && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/70 bg-muted/50 px-2 py-0.5 rounded">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {step.duration}
                        </span>
                      )}
                      {step.timestamp != null && onSeek && (
                        <Timestamp seconds={step.timestamp} onClick={() => onSeek(step.timestamp!)} />
                      )}
                    </div>

                    {/* Timer integration */}
                    {timers && durationSecs > 0 && isActive && !isDone && (
                      <Timer
                        duration={durationSecs}
                        onComplete={() => toggleComplete(index)}
                        className="mt-2"
                      />
                    )}

                    {step.tips && isActive && (
                      <TextBlock intent="tip" icon={<Lightbulb />} className="mt-1">
                        {step.tips}
                      </TextBlock>
                    )}

                    {step.safetyNote && isActive && (
                      <TextBlock intent="warning" icon={<AlertTriangle />} className="mt-1">
                        {step.safetyNote}
                      </TextBlock>
                    )}
                  </div>

                  {/* Right: 72px thumbnail */}
                  {step.thumbnailUrl && (
                    <img
                      src={step.thumbnailUrl}
                      alt={step.title || `Step ${step.number}`}
                      loading="lazy"
                      className="w-[72px] h-[72px] rounded-lg object-cover shrink-0 border border-border/30"
                    />
                  )}

                  {/* Complete button */}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => { e.stopPropagation(); toggleComplete(index); }}
                    className={cn('shrink-0 rounded-full', isDone && 'text-success hover:text-success')}
                    aria-label={isDone ? `Mark step ${step.number} incomplete` : `Mark step ${step.number} complete`}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </GlassCard>
            </FadeIn>
          );
        })}
      </div>

      {/* Stepper dots for one-at-a-time */}
      {isOneAtATime && steps.length > 1 && (
        <Stepper
          total={steps.length}
          current={currentStep}
          completedSteps={completedSteps}
          onStepClick={setCurrentStep}
        />
      )}

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

    </div>
  );
});
