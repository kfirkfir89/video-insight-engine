import { memo, useCallback, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { QuizItem } from '@vie/types';
import { GlassCard } from '../GlassCard';
import { Celebration } from '../Celebration';
import { CrossTabLink } from '../CrossTabLink';
import { ScoreRing } from '../../blocks/ScoreRing';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

interface QuizInteractiveProps {
  questions: QuizItem[];
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

export const QuizInteractive = memo(function QuizInteractive({
  questions,
  nextTab,
  onNavigateTab,
}: QuizInteractiveProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<number, number>>(new Map());

  const handleSelect = useCallback(
    (optionIndex: number) => {
      if (answers.has(currentIndex)) return;
      setAnswers((prev) => {
        const next = new Map(prev);
        next.set(currentIndex, optionIndex);
        return next;
      });
    },
    [answers, currentIndex],
  );

  const score = useMemo(() => {
    let correct = 0;
    answers.forEach((picked, qIndex) => {
      if (questions[qIndex]?.correctIndex === picked) correct++;
    });
    return correct;
  }, [answers, questions]);

  const allAnswered = questions.length > 0 && answers.size === questions.length;

  if (questions.length === 0) return null;

  const question = questions[currentIndex];
  const selectedOption = answers.get(currentIndex);
  const isAnswered = selectedOption !== undefined;

  return (
    <GlassCard className="space-y-4">
      {/* Progress text */}
      <div className="text-xs text-muted-foreground/70 text-center">
        Q {currentIndex + 1} of {questions.length}
      </div>

      {/* Question */}
      <p className="font-medium text-sm text-center px-2">{question.question}</p>

      {/* Options */}
      <div className="space-y-2">
        {question.options.map((option, oIndex) => {
          const isSelected = selectedOption === oIndex;
          const isCorrect = question.correctIndex === oIndex;

          return (
            <Button
              key={oIndex}
              variant="ghost"
              size="bare"
              onClick={() => handleSelect(oIndex)}
              disabled={isAnswered}
              className={cn(
                'w-full text-left px-3 py-2.5 rounded-lg text-sm',
                'transition-all duration-150 whitespace-normal justify-start border',
                isAnswered && isCorrect && 'bg-success-soft border-success/50',
                isAnswered && isSelected && !isCorrect && 'bg-destructive/10 border-destructive/50',
                !isAnswered && 'border-border/50 hover:bg-muted/50 active:scale-[0.97]',
              )}
            >
              <div className="flex items-center gap-2.5">
                <span className="shrink-0 w-6 h-6 rounded-full bg-muted/40 flex items-center justify-center text-xs font-semibold">
                  {OPTION_LABELS[oIndex] ?? oIndex + 1}
                </span>
                <span className="flex-1">{option}</span>
                {isAnswered && isCorrect && (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" aria-hidden="true" />
                )}
                {isAnswered && isSelected && !isCorrect && (
                  <XCircle className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
                )}
              </div>
            </Button>
          );
        })}
      </div>

      {/* Explanation */}
      {isAnswered && (
        <div className="animate-[fadeUp_0.2s_ease-out_both] bg-muted/20 rounded-lg p-3 text-sm">
          <span className="font-medium text-xs text-muted-foreground block mb-1">Explanation</span>
          <p className="text-muted-foreground">{question.explanation}</p>
        </div>
      )}

      {/* Navigation */}
      {questions.length > 1 && (
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
            disabled={currentIndex === questions.length - 1}
            className="gap-1 text-xs"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Completion */}
      {allAnswered && (
        <div className="flex flex-col items-center gap-4">
          <ScoreRing score={score} maxScore={questions.length} label="Correct" size="md" />
          <Celebration
            emoji="🧠"
            title={score === questions.length ? 'Perfect score!' : 'Quiz complete!'}
            subtitle={`${score} of ${questions.length} correct`}
            nextTabId={nextTab}
            nextLabel={nextTab ? 'Continue' : undefined}
            onNavigateTab={onNavigateTab}
          />
        </div>
      )}

      {/* Cross-tab link */}
      {!allAnswered && nextTab && onNavigateTab && (
        <CrossTabLink tabId={nextTab} label="Continue" onNavigate={onNavigateTab} />
      )}
    </GlassCard>
  );
});
