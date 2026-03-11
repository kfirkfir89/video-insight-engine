import { memo, useCallback, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ScenarioItem } from '@vie/types';
import { GlassCard } from '../GlassCard';
import { Celebration } from '../Celebration';
import { CrossTabLink } from '../CrossTabLink';
import { ScoreRing } from '../../blocks/ScoreRing';

interface ScenarioInteractiveProps {
  scenarios: ScenarioItem[];
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

export const ScenarioInteractive = memo(function ScenarioInteractive({
  scenarios,
  nextTab,
  onNavigateTab,
}: ScenarioInteractiveProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [picks, setPicks] = useState<Map<number, number>>(new Map());
  const [shakingOption, setShakingOption] = useState<number | null>(null);

  const handleSelect = useCallback(
    (optionIndex: number) => {
      if (picks.has(currentIndex)) return;

      setPicks((prev) => {
        const next = new Map(prev);
        next.set(currentIndex, optionIndex);
        return next;
      });

      const option = scenarios[currentIndex]?.options[optionIndex];
      if (option && !option.correct) {
        setShakingOption(optionIndex);
        setTimeout(() => setShakingOption(null), 300);
      }
    },
    [picks, currentIndex, scenarios],
  );

  const score = useMemo(() => {
    let correct = 0;
    picks.forEach((oIndex, sIndex) => {
      if (scenarios[sIndex]?.options[oIndex]?.correct) correct++;
    });
    return correct;
  }, [picks, scenarios]);

  const allDone = scenarios.length > 0 && picks.size === scenarios.length;

  if (scenarios.length === 0) return null;

  const scenario = scenarios[currentIndex];
  const selectedOption = picks.get(currentIndex);
  const isAnswered = selectedOption !== undefined;

  return (
    <GlassCard className="space-y-4">
      {/* Progress */}
      {scenarios.length > 1 && (
        <div className="text-xs text-muted-foreground/70 text-center">
          Scenario {currentIndex + 1} of {scenarios.length}
        </div>
      )}

      {/* Question */}
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <div className="bg-muted/20 px-4 py-3">
          <div className="flex items-center gap-2">
            {scenario.emoji && (
              <span className="text-2xl" aria-hidden="true">{scenario.emoji}</span>
            )}
            <p className="font-medium text-sm">{scenario.question}</p>
          </div>
        </div>

        {/* Options */}
        <div className="p-4 space-y-2">
          {scenario.options.map((option, oIndex) => {
            const isSelected = selectedOption === oIndex;
            const isCorrectOption = option.correct;
            const showResult = isAnswered && isSelected;
            const isShaking = shakingOption === oIndex;

            return (
              <Button
                key={oIndex}
                variant="ghost"
                size="bare"
                onClick={() => handleSelect(oIndex)}
                disabled={isAnswered}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md text-sm',
                  'transition-all duration-150 whitespace-normal justify-start border',
                  isShaking && 'animate-shake',
                  isAnswered && isCorrectOption && 'bg-success-soft border-success/50',
                  showResult && !isCorrectOption && 'bg-destructive/10 border-destructive/50',
                  !isAnswered && 'border-border/50 hover:bg-muted/50 active:scale-[0.97]',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1">{option.text}</span>
                  {isAnswered && isCorrectOption && (
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" aria-hidden="true" />
                  )}
                  {showResult && !isCorrectOption && (
                    <XCircle className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
                  )}
                </div>
              </Button>
            );
          })}
        </div>

        {/* Explanation */}
        {isAnswered && selectedOption !== undefined && (
          <div className="px-4 pb-4">
            <div className="bg-muted/20 rounded-md p-3 text-sm">
              <span className="font-medium text-xs text-muted-foreground block mb-1">Explanation</span>
              <p className="text-muted-foreground">
                {scenario.options[selectedOption]?.explanation}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      {scenarios.length > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentIndex((p) => p - 1)}
            disabled={currentIndex === 0}
            className="gap-1 text-xs"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentIndex((p) => p + 1)}
            disabled={currentIndex === scenarios.length - 1}
            className="gap-1 text-xs"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Completion */}
      {allDone && (
        <div className="flex flex-col items-center gap-4">
          <ScoreRing score={score} maxScore={scenarios.length} label="Correct" size="md" />
          <Celebration
            emoji="🎯"
            title={score === scenarios.length ? 'Perfect!' : 'Scenarios complete!'}
            subtitle={`${score} of ${scenarios.length} correct`}
            nextTabId={nextTab}
            nextLabel={nextTab ? 'Continue' : undefined}
            onNavigateTab={onNavigateTab}
          />
        </div>
      )}

      {/* Cross-tab link */}
      {!allDone && nextTab && onNavigateTab && (
        <CrossTabLink tabId={nextTab} label="Continue" onNavigate={onNavigateTab} />
      )}
    </GlassCard>
  );
});
