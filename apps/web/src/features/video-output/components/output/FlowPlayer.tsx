import { memo, useState, useCallback, useMemo, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { GlassCard } from './GlassCard';
import { EmojiMarker } from '@/components/vie';
import { useTabState } from '@/features/video-output/contexts/TabStateContext';

/** Render-prop arguments handed to a mode's `renderStep` slot. The shell owns
 *  the current-step index and completion tracking; the mode owns how a single
 *  step is presented. */
export interface FlowStepRenderArgs {
  currentStep: number;
  onStepChange: (index: number) => void;
  onComplete: (index: number) => void;
  isStepCompleted: (index: number) => boolean;
}

export interface FlowPlayerProps {
  /** Mode emoji shown in the header + celebration (e.g. "🍳"). */
  emoji: string;
  /** Header title — the mode name (e.g. "Cooking Mode"). */
  modeLabel: string;
  /** Word for one sequence entry, used in the "N/M steps" counter (e.g. "steps"). */
  stepNoun?: string;
  /** Left/drawer panel heading (e.g. "Ingredients"). */
  contextLabel: string;
  /** Count shown next to the context label in the mobile drawer. */
  contextCount: number;
  /** Renders the context panel body (ingredients, materials, warmup, …). */
  renderContext: () => ReactNode;
  /** Number of entries in the action sequence — drives progress + stepper. */
  sequenceLength: number;
  /** Renders the active step pane given shell-owned step state. */
  renderStep: (args: FlowStepRenderArgs) => ReactNode;
  /** Message shown when every step is completed. */
  completionMessage: string;
  onExit: () => void;
}

/**
 * Generic "enter mode" shell — a focused two-panel runner (context on the left,
 * a sequenced action pane on the right) with a progress bar, stepper dots, and a
 * completion celebration. Extracted from RecipePlayer so every domain with a
 * context list + ordered sequence (cooking, workout, build, study, …) reuses the
 * same behavior. Step-completion state is tracked in TabStateContext, exactly as
 * cooking mode did, so progress survives leaving and re-entering the mode.
 */
export const FlowPlayer = memo(function FlowPlayer({
  emoji,
  modeLabel,
  stepNoun = 'steps',
  contextLabel,
  contextCount,
  renderContext,
  sequenceLength,
  renderStep,
  completionMessage,
  onExit,
}: FlowPlayerProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [contextOpen, setContextOpen] = useState(false);
  const tabState = useTabState();

  const handleStepChange = useCallback((index: number) => {
    if (index >= 0 && index < sequenceLength) setCurrentStep(index);
  }, [sequenceLength]);

  const handleComplete = useCallback((index: number) => {
    if (tabState.isStepCompleted(index)) {
      tabState.uncompleteStep(index);
    } else {
      tabState.completeStep(index);
      // Auto-advance to the next not-yet-completed step.
      let nextIdx = -1;
      for (let i = index + 1; i < sequenceLength; i++) {
        if (!tabState.isStepCompleted(i)) { nextIdx = i; break; }
      }
      if (nextIdx !== -1) setCurrentStep(nextIdx);
      else if (index < sequenceLength - 1) setCurrentStep(index + 1);
    }
  }, [tabState, sequenceLength]);

  const completedCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < sequenceLength; i++) {
      if (tabState.isStepCompleted(i)) count++;
    }
    return count;
  }, [sequenceLength, tabState]);

  const progressPercent = sequenceLength > 0
    ? Math.round((completedCount / sequenceLength) * 100)
    : 0;
  const allDone = completedCount === sequenceLength && sequenceLength > 0;

  const stepArgs: FlowStepRenderArgs = {
    currentStep,
    onStepChange: handleStepChange,
    onComplete: handleComplete,
    isStepCompleted: tabState.isStepCompleted,
  };

  return (
    <GlassCard className="overflow-hidden p-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-primary/5 border-b border-border/30">
        <div className="flex items-center gap-2">
          <EmojiMarker emoji={emoji} size="sm" animated={false} />
          <span className="text-sm font-semibold">{modeLabel}</span>
          <span className="text-xs text-muted-foreground">
            {completedCount}/{sequenceLength} {stepNoun}
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={onExit} aria-label={`Exit ${modeLabel.toLowerCase()}`}>
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
        {/* Mobile: Collapsible context drawer */}
        <div className="md:hidden">
          <button
            onClick={() => setContextOpen(p => !p)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border/30 hover:bg-muted/20"
          >
            <span>{contextLabel} ({contextCount})</span>
            <span>{contextOpen ? '▲' : '▼'}</span>
          </button>
          {contextOpen && (
            <div className="max-h-[200px] overflow-y-auto border-b border-border/30">
              {renderContext()}
            </div>
          )}
        </div>

        {/* Desktop: Left context panel.
            max-w caps the panel on ~768px tablets so the step pane keeps
            enough room for comfortable reading; 280px retained as the target. */}
        <div className="hidden md:block w-[280px] max-w-[min(280px,38vw)] border-e border-border/30 overflow-y-auto">
          {renderContext()}
        </div>

        {/* Right panel — sequenced action pane */}
        <div className="flex-1">
          {renderStep(stepArgs)}
        </div>
      </div>

      {/* Stepper bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-t border-border/30 overflow-x-auto">
        {Array.from({ length: sequenceLength }, (_, i) => (
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
        <div className="flex items-center justify-center gap-2 py-4 bg-success/5 border-t border-border/30">
          <EmojiMarker emoji="🎉" size="sm" />
          <p className="text-sm font-medium text-success">
            {completionMessage}
          </p>
        </div>
      )}
    </GlassCard>
  );
});
