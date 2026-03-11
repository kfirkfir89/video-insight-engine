import { memo, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, HelpCircle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BlockWrapper } from './BlockWrapper';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface ScenarioOption {
  text: string;
  correct: boolean;
  explanation: string;
}

interface Scenario {
  question: string;
  options: ScenarioOption[];
  emoji?: string;
}

interface ScenarioCardProps {
  scenarios: Scenario[];
}

/**
 * Interactive "Which X?" challenge cards.
 * One-at-a-time display, select option to reveal correct/incorrect + explanation.
 * Tracks score across scenarios. Wrong answer triggers shake animation.
 */
export const ScenarioCard = memo(function ScenarioCard({ scenarios }: ScenarioCardProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Map<number, number>>(new Map());
  const [shakingOption, setShakingOption] = useState<number | null>(null);

  const handleSelect = useCallback((scenarioIndex: number, optionIndex: number) => {
    if (selectedOptions.has(scenarioIndex)) return;

    setSelectedOptions(prev => {
      const next = new Map(prev);
      next.set(scenarioIndex, optionIndex);
      return next;
    });

    // Shake if wrong
    const option = scenarios[scenarioIndex]?.options[optionIndex];
    if (option && !option.correct) {
      setShakingOption(optionIndex);
      setTimeout(() => setShakingOption(null), 300);
    }
  }, [selectedOptions, scenarios]);

  if (scenarios.length === 0) return null;

  const scenario = scenarios[activeIndex];
  const selectedOption = selectedOptions.get(activeIndex);
  const isAnswered = selectedOption !== undefined;
  const allAnswered = scenarios.every((_, i) => selectedOptions.has(i));

  // Compute score
  const correctCount = Array.from(selectedOptions.entries()).reduce((acc, [sIndex, oIndex]) => {
    const opt = scenarios[sIndex]?.options[oIndex];
    return acc + (opt?.correct ? 1 : 0);
  }, 0);

  return (
    <BlockWrapper
      blockId={undefined}
      label={BLOCK_LABELS.scenarios}
      variant="card"
      headerIcon={<HelpCircle className="h-4 w-4" />}
      headerLabel={BLOCK_LABELS.scenarios}
    >
      <div className="space-y-4">
        {/* Score summary when all answered */}
        {allAnswered && (
          <div className="animate-pop-in text-center p-4 rounded-lg bg-[rgba(52,211,153,0.06)]">
            <div className="text-lg font-bold">
              {BLOCK_LABELS.yourScore}: {correctCount}/{scenarios.length}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {correctCount === scenarios.length
                ? 'Perfect score!'
                : correctCount >= scenarios.length / 2
                  ? 'Good job!'
                  : 'Keep practicing!'}
            </p>
          </div>
        )}

        {/* Progress */}
        {scenarios.length > 1 && (
          <div className="text-xs text-muted-foreground/70 text-center">
            {BLOCK_LABELS.scenario} {activeIndex + 1} {BLOCK_LABELS.of} {scenarios.length}
          </div>
        )}

        {/* Scenario question */}
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
                  onClick={() => handleSelect(activeIndex, oIndex)}
                  disabled={isAnswered}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-sm transition-all duration-150 whitespace-normal justify-start',
                    'border',
                    isShaking && 'animate-shake',
                    isAnswered && isCorrectOption && 'bg-success-soft border-success/50 glow-success',
                    showResult && !isCorrectOption && 'bg-destructive/10 border-destructive/50',
                    !isAnswered && 'border-border/50 hover:bg-muted/50',
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
                <span className="font-medium text-xs text-muted-foreground block mb-1">
                  {BLOCK_LABELS.explanation}
                </span>
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
              onClick={() => setActiveIndex(prev => prev - 1)}
              disabled={activeIndex === 0}
              className="gap-1 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveIndex(prev => prev + 1)}
              disabled={activeIndex === scenarios.length - 1}
              className="gap-1 text-xs"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </BlockWrapper>
  );
});
