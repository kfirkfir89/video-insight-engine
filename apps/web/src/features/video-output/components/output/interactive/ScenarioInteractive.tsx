import { memo, useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { ScenarioItem } from '@vie/types';
import { GlassCard, FadeIn, OptionGrid, InlineScore, Shake, BackForward, Stepper, ScoreRing } from '@/components/vie';
import { Celebration } from '../Celebration';


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
  const [shaking, setShaking] = useState(false);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => { if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current); }, []);

  const pickedSteps = useMemo(() => new Set(picks.keys()), [picks]);

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
        setShaking(true);
        if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
        shakeTimerRef.current = setTimeout(() => setShaking(false), 400);
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
  const correctIdx = isAnswered
    ? scenario.options.findIndex((o) => o.correct)
    : undefined;

  return (
    <GlassCard className="space-y-4">
      {/* Progress + score */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground/70">
          Scenario {currentIndex + 1} of {scenarios.length}
        </div>
        {picks.size > 0 && <InlineScore correct={score} total={picks.size} />}
      </div>

      {/* Context / Question */}
      <FadeIn key={currentIndex}>
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <div className="bg-muted/20 px-4 py-3">
            <div className="flex items-center gap-2">
              {scenario.emoji && <span className="text-2xl" aria-hidden="true">{scenario.emoji}</span>}
              <p className="font-medium text-sm">{scenario.question}</p>
            </div>
          </div>

          {/* Options */}
          <div className="p-4">
            <Shake active={shaking}>
              <OptionGrid
                options={scenario.options.map((o) => o.text)}
                selectedIndex={selectedOption}
                correctIndex={correctIdx}
                onSelect={handleSelect}
              />
            </Shake>
          </div>

          {/* Explanations revealed after answer */}
          {isAnswered && (
            <FadeIn>
              <div className="px-4 pb-4 space-y-2">
                {scenario.options.map((opt, oIdx) => (
                  <div
                    key={oIdx}
                    className={cn(
                      'rounded-md p-3 text-sm',
                      opt.correct ? 'bg-success-soft' : 'bg-muted/10 opacity-70',
                    )}
                  >
                    <span className="font-medium text-xs block mb-0.5">
                      {opt.correct ? 'Correct' : `Option: ${opt.text}`}
                    </span>
                    <p className="text-muted-foreground text-xs">{opt.explanation}</p>
                  </div>
                ))}
              </div>
            </FadeIn>
          )}
        </div>
      </FadeIn>

      {/* Navigation */}
      {scenarios.length > 1 && (
        <BackForward
          onBack={() => setCurrentIndex((p) => p - 1)}
          onForward={() => setCurrentIndex((p) => p + 1)}
          backDisabled={currentIndex === 0}
          forwardDisabled={currentIndex === scenarios.length - 1}
        />
      )}

      {/* Stepper */}
      {scenarios.length > 1 && (
        <Stepper
          total={scenarios.length}
          current={currentIndex}
          completedSteps={pickedSteps}
          onStepClick={setCurrentIndex}
        />
      )}

      {/* Completion */}
      {allDone && (
        <div className="flex flex-col items-center gap-4">
          <ScoreRing score={score} total={scenarios.length} label="Correct" size="md" />
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

    </GlassCard>
  );
});
