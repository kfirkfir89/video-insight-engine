import { memo, useState, useCallback, useMemo } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { GlassCard } from './GlassCard';
import { RecipeIngredientPanel } from './RecipeIngredientPanel';
import { RecipeStepView } from './RecipeStepView';
import { useTabState } from '@/features/video-output/contexts/TabStateContext';
import type { StepItem } from '@vie/types';

interface IngredientItem {
  label: string;
  note?: string;
  emoji?: string;
  amount?: number;
  displayAmount?: string;
  unit?: string;
  essential?: boolean;
  group?: string;
}

interface RecipePlayerProps {
  ingredients: IngredientItem[];
  steps: StepItem[];
  scalable?: boolean;
  baseServings?: number;
  tabLabel?: string;
  onExit: () => void;
  onSeek?: (seconds: number) => void;
}

export const RecipePlayer = memo(function RecipePlayer({
  ingredients,
  steps,
  scalable,
  baseServings,
  tabLabel = 'Ingredients',
  onExit,
  onSeek,
}: RecipePlayerProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [ingredientsOpen, setIngredientsOpen] = useState(false);
  const tabState = useTabState();

  const handleStepChange = useCallback((index: number) => {
    if (index >= 0 && index < steps.length) setCurrentStep(index);
  }, [steps.length]);

  const handleComplete = useCallback((index: number) => {
    if (tabState.isStepCompleted(index)) {
      tabState.uncompleteStep(index);
    } else {
      tabState.completeStep(index);
      // Auto-advance to next incomplete step
      const nextIdx = steps.findIndex((_, i) => i > index && !tabState.isStepCompleted(i));
      if (nextIdx !== -1) setCurrentStep(nextIdx);
      else if (index < steps.length - 1) setCurrentStep(index + 1);
    }
  }, [tabState, steps]);

  // Step progress
  const completedCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < steps.length; i++) {
      if (tabState.isStepCompleted(i)) count++;
    }
    return count;
  }, [steps.length, tabState]);

  const progressPercent = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;
  const allDone = completedCount === steps.length && steps.length > 0;

  return (
    <GlassCard className="overflow-hidden p-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-primary/5 border-b border-border/30">
        <div className="flex items-center gap-2">
          <span aria-hidden="true">{'🍳'}</span>
          <span className="text-sm font-semibold">Cooking Mode</span>
          <span className="text-xs text-muted-foreground">
            {completedCount}/{steps.length} steps
          </span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onExit} aria-label="Exit cooking mode">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full bg-muted/30">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Content area */}
      <div className="flex flex-col md:flex-row min-h-[400px]">
        {/* Mobile: Collapsible ingredients drawer */}
        <div className="md:hidden">
          <button
            onClick={() => setIngredientsOpen(p => !p)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border/30 hover:bg-muted/20"
          >
            <span>{tabLabel} ({ingredients.length})</span>
            <span>{ingredientsOpen ? '▲' : '▼'}</span>
          </button>
          {ingredientsOpen && (
            <div className="max-h-[200px] overflow-y-auto border-b border-border/30">
              <RecipeIngredientPanel
                items={ingredients}
                tabLabel={tabLabel}
                scalable={scalable}
                baseServings={baseServings}
              />
            </div>
          )}
        </div>

        {/* Desktop: Left panel — Ingredients */}
        <div className="hidden md:block w-[280px] border-r border-border/30 overflow-y-auto">
          <RecipeIngredientPanel
            items={ingredients}
            tabLabel={tabLabel}
            scalable={scalable}
            baseServings={baseServings}
          />
        </div>

        {/* Right panel — Step view */}
        <div className="flex-1">
          <RecipeStepView
            steps={steps}
            currentStep={currentStep}
            onStepChange={handleStepChange}
            onComplete={handleComplete}
            onSeek={onSeek}
            ingredients={ingredients}
          />
        </div>
      </div>

      {/* Stepper bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-t border-border/30 overflow-x-auto">
        {steps.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentStep(i)}
            className={cn(
              'h-2 rounded-full transition-all duration-200 min-w-[12px] flex-1',
              i === currentStep
                ? 'bg-primary'
                : tabState.isStepCompleted(i)
                  ? 'bg-success/60'
                  : 'bg-muted/40',
            )}
            aria-label={`Go to step ${i + 1}`}
          />
        ))}
      </div>

      {/* All done celebration */}
      {allDone && (
        <div className="text-center py-4 bg-success/5 border-t border-border/30">
          <p className="text-sm font-medium text-success">
            {'🎉'} All steps complete! Enjoy your meal!
          </p>
        </div>
      )}
    </GlassCard>
  );
});
