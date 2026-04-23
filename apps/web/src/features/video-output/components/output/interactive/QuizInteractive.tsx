import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { QuizItem } from '@vie/types';
import { GlassCard, FadeIn, OptionGrid, InlineScore, Shake, BackForward, Stepper, ScoreRing, Badge, EmojiMarker } from '@/components/vie';
import { Button } from '@/components/ui/button';
import { Celebration } from '../Celebration';
import { useLabels } from '@/lib/i18n';

import { useTabState } from '@/features/video-output/contexts/TabStateContext';
import { useTabCoordination } from '../TabCoordinationContext';

interface QuizInteractiveProps {
  questions: QuizItem[];
  tabId?: string;
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

export const QuizInteractive = memo(function QuizInteractive({
  questions,
  tabId = 'quizzes',
  nextTab,
  onNavigateTab,
}: QuizInteractiveProps) {
  const t = useLabels();
  const tabState = useTabState();
  const tabCoord = useTabCoordination();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<number, number>>(new Map());
  const [shaking, setShaking] = useState(false);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(shakeTimerRef.current), []);

  const answeredSteps = useMemo(() => new Set(answers.keys()), [answers]);

  const handleSelect = useCallback(
    (optionIndex: number) => {
      if (answers.has(currentIndex)) return;
      setAnswers((prev) => {
        const next = new Map(prev);
        next.set(currentIndex, optionIndex);
        return next;
      });
      const isCorrect = questions[currentIndex]?.correctIndex === optionIndex;
      tabState.setQuizResult(String(currentIndex), isCorrect);
      if (isCorrect) {
        setStreak((prev) => {
          const next = prev + 1;
          setMaxStreak((m) => Math.max(m, next));
          return next;
        });
      } else {
        setStreak(0);
        setShaking(true);
        clearTimeout(shakeTimerRef.current);
        shakeTimerRef.current = setTimeout(() => setShaking(false), 400);
      }
    },
    [answers, currentIndex, questions, tabState],
  );

  const score = useMemo(() => {
    let correct = 0;
    answers.forEach((picked, qIndex) => {
      if (questions[qIndex]?.correctIndex === picked) correct++;
    });
    return correct;
  }, [answers, questions]);

  const wrongAnswers = useMemo(() => {
    if (answers.size < questions.length) return [];
    const wrong: Array<{ index: number; question: string; picked: string; correct: string }> = [];
    answers.forEach((picked, qIndex) => {
      const q = questions[qIndex];
      if (q && q.correctIndex !== picked) {
        wrong.push({
          index: qIndex,
          question: q.question,
          picked: q.options[picked] ?? '?',
          correct: q.options[q.correctIndex] ?? '?',
        });
      }
    });
    return wrong;
  }, [answers, questions]);

  const allAnswered = questions.length > 0 && answers.size === questions.length;
  const scorePercent = questions.length > 0 ? (score / questions.length) * 100 : 0;

  // Mark tab completed when all answered
  useEffect(() => {
    if (allAnswered) tabCoord?.markTabCompleted(tabId);
  }, [allAnswered, tabCoord, tabId]);

  // Read mastered cards from FlashDeck for "studied this" badges
  const masteredQuestions = useMemo(() => {
    if (tabState.masteredCards.size === 0) return new Set<number>();
    const mastered = new Set<number>();
    tabState.masteredCards.forEach((cardIdx) => {
      const idx = parseInt(cardIdx, 10);
      if (!isNaN(idx) && idx < questions.length) mastered.add(idx);
    });
    return mastered;
  }, [tabState.masteredCards, questions.length]);

  const handleReset = useCallback(() => {
    setCurrentIndex(0);
    setAnswers(new Map());
    setStreak(0);
    setMaxStreak(0);
    setShaking(false);
  }, []);

  if (questions.length === 0) return null;

  const question = questions[currentIndex];
  const selectedOption = answers.get(currentIndex);
  const isAnswered = selectedOption !== undefined;

  return (
    <GlassCard variant="elevated" className="space-y-4">
      {/* Score + progress + streak */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium tabular-nums tracking-wide text-muted-foreground/70">
          Q {currentIndex + 1} of {questions.length}
        </div>
        <div className="flex items-center gap-2">
          {streak >= 2 && (
            <Badge variant="warning" className="text-xs font-semibold tabular-nums animate-[fadeUp_0.2s_ease_both] inline-flex items-center gap-1">
              <EmojiMarker emoji="🔥" size="sm" animated={false} />
              {streak} streak!
            </Badge>
          )}
          {answers.size > 0 && <InlineScore correct={score} total={answers.size} />}
        </div>
      </div>

      {/* Question */}
      <FadeIn key={currentIndex}>
        <div className="text-center px-2">
          <p className="font-semibold text-base leading-snug tracking-tight">{question.question}</p>
          {masteredQuestions.has(currentIndex) && (
            <Badge variant="info" className="mt-1.5 text-xs font-medium inline-flex items-center gap-1">
              <EmojiMarker emoji="📚" size="sm" animated={false} />
              You studied this
            </Badge>
          )}
        </div>
      </FadeIn>

      {/* Options with shake */}
      <Shake active={shaking}>
        <OptionGrid
          options={question.options}
          selectedIndex={selectedOption}
          correctIndex={isAnswered ? question.correctIndex : undefined}
          onSelect={handleSelect}
        />
      </Shake>

      {/* Explanation */}
      {isAnswered && (
        <FadeIn>
          <div className="bg-muted/20 rounded-lg p-3">
            <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground block mb-1">Explanation</span>
            <p className="text-sm leading-relaxed text-muted-foreground">{question.explanation}</p>
          </div>
        </FadeIn>
      )}

      {/* Navigation */}
      {questions.length > 1 && (
        <BackForward
          onBack={() => setCurrentIndex((p) => p - 1)}
          onForward={() => setCurrentIndex((p) => p + 1)}
          backDisabled={currentIndex === 0}
          forwardDisabled={currentIndex === questions.length - 1}
          backLabel={t.previous}
          forwardLabel={t.next}
        />
      )}

      {/* Stepper dots */}
      {questions.length > 1 && (
        <Stepper
          total={questions.length}
          current={currentIndex}
          completedSteps={answeredSteps}
          onStepClick={setCurrentIndex}
        />
      )}

      {/* Completion */}
      {allAnswered && (
        <div className="flex flex-col items-center gap-4">
          <ScoreRing score={score} total={questions.length} label={t.correct} size="md" />

          {/* Only celebrate on good scores */}
          {scorePercent >= 80 && (
            <Celebration
              emoji="\uD83E\uDDE0"
              title={score === questions.length ? 'Perfect score!' : 'Great job!'}
              subtitle={`${score} of ${questions.length} correct${maxStreak >= 3 ? ` | Best streak: ${maxStreak}` : ''}`}
              nextTabId={nextTab}
              nextLabel={nextTab ? 'Review material' : undefined}
              onNavigateTab={onNavigateTab}
            />
          )}

          {/* End summary for wrong answers */}
          {wrongAnswers.length > 0 && (
            <FadeIn>
              <GlassCard variant="outlined" className="space-y-3 w-full">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t.review} <span className="tabular-nums">({wrongAnswers.length}</span> {t.missed})
                </h4>
                <ul className="space-y-2">
                  {wrongAnswers.map((w) => (
                    <li key={w.index} className="space-y-1">
                      <p className="font-semibold text-sm leading-snug">{w.question}</p>
                      <p className="text-destructive text-xs leading-relaxed">
                        Your answer: {w.picked}
                      </p>
                      <p className="text-success text-xs leading-relaxed">
                        Correct: {w.correct}
                      </p>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-medium"
                  onClick={handleReset}
                >
                  {t.tryAgain}
                </Button>
              </GlassCard>
            </FadeIn>
          )}

          {/* Perfect score — just show try again + next */}
          {wrongAnswers.length === 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs font-medium"
              onClick={handleReset}
            >
              {t.tryAgain}
            </Button>
          )}
        </div>
      )}

    </GlassCard>
  );
});
