import { memo, useMemo } from 'react';
import { Check, AlertTriangle, Lightbulb, Clock, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Timer, Badge } from '@/components/vie';
import { useTabState } from '@/features/video-output/contexts/TabStateContext';
import { buildStepIngredientMap } from '@/features/video-output/components/output/lib/ingredient-step-matcher';
import type { StepItem } from '@vie/types';

interface RecipeStepViewProps {
  steps: StepItem[];
  currentStep: number;
  onStepChange: (index: number) => void;
  onComplete: (index: number) => void;
  onSeek?: (seconds: number) => void;
  ingredients?: Array<{ label: string }>;
}

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

export const RecipeStepView = memo(function RecipeStepView({
  steps,
  currentStep,
  onStepChange,
  onComplete,
  onSeek,
  ingredients,
}: RecipeStepViewProps) {
  const tabState = useTabState();
  const step = steps[currentStep];

  // Pre-compute ingredient→step mapping
  const stepIngredientMap = useMemo(() => {
    if (!ingredients || ingredients.length === 0) return new Map<number, number[]>();
    return buildStepIngredientMap(steps, ingredients);
  }, [steps, ingredients]);

  // Get checked ingredients for current step
  const stepReadiness = useMemo(() => {
    const matched = stepIngredientMap.get(currentStep);
    if (!matched || matched.length === 0) return null;
    const checkedCount = matched.filter(i => tabState.isChecked('checklist', i)).length;
    return { total: matched.length, checked: checkedCount, allReady: checkedCount === matched.length };
  }, [currentStep, stepIngredientMap, tabState]);

  if (!step) return null;

  const isDone = tabState.isStepCompleted(currentStep);
  const durationSecs = parseDurationSeconds(step.duration);

  return (
    <div className="flex flex-col h-full">
      {/* Step header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Step {step.number} of {steps.length}
          </span>
          {isDone && (
            <Badge variant="success" className="text-[10px]">Done</Badge>
          )}
        </div>
        {/* Readiness pill */}
        {stepReadiness && (
          <span className={cn(
            'text-[10px] px-2 py-0.5 rounded-full transition-colors',
            stepReadiness.allReady
              ? 'bg-success/10 text-success'
              : 'bg-warning/10 text-warning',
          )}>
            {stepReadiness.checked}/{stepReadiness.total} ingredients ready
          </span>
        )}
      </div>

      {/* Step content — scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {step.title && (
          <h3 className={cn('text-lg font-semibold', isDone && 'line-through opacity-60')}>
            {step.title}
          </h3>
        )}

        <p className={cn('text-base leading-relaxed', isDone && 'line-through opacity-60')}>
          {step.instruction}
        </p>

        {/* Duration + seek */}
        <div className="flex items-center gap-3 flex-wrap">
          {step.duration && (
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground bg-muted/50 px-3 py-1 rounded-lg">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {step.duration}
            </span>
          )}
          {step.timestamp != null && onSeek && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSeek(step.timestamp!)}
              className="gap-1.5"
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              Watch this step
            </Button>
          )}
        </div>

        {/* Timer */}
        {durationSecs > 0 && !isDone && (
          <Timer
            duration={durationSecs}
            onComplete={() => onComplete(currentStep)}
            className="mt-2"
          />
        )}

        {/* Tips */}
        {step.tips && (
          <div className="flex items-start gap-2 text-sm text-info bg-info/5 rounded-lg px-3 py-2">
            <Lightbulb className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{step.tips}</span>
          </div>
        )}

        {/* Safety */}
        {step.safetyNote && (
          <div className="flex items-start gap-2 text-sm text-warning bg-warning-soft rounded-lg px-3 py-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{step.safetyNote}</span>
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border/30">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onStepChange(currentStep - 1)}
          disabled={currentStep === 0}
          className="gap-1.5"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Prev
        </Button>

        <Button
          variant={isDone ? 'outline' : 'default'}
          size="sm"
          onClick={() => onComplete(currentStep)}
          className="gap-1.5 min-h-[44px]"
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          {isDone ? 'Undo' : 'Done'}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onStepChange(currentStep + 1)}
          disabled={currentStep === steps.length - 1}
          className="gap-1.5"
        >
          Next
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
});
