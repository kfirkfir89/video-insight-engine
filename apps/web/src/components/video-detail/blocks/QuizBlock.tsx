import { memo, useState } from 'react';
import { HelpCircle, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BlockWrapper } from './BlockWrapper';
import { ConceptHighlighter } from '../ConceptHighlighter';
import type { QuizBlock as QuizBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface QuizBlockProps {
  block: QuizBlockType;
}

/**
 * Renders interactive quiz questions with reveal answers.
 */
export const QuizBlock = memo(function QuizBlock({ block }: QuizBlockProps) {
  const questions = block.questions ?? [];
  const [revealedAnswers, setRevealedAnswers] = useState<Set<number>>(new Set());
  const [selectedAnswers, setSelectedAnswers] = useState<Map<number, number>>(new Map());

  if (questions.length === 0) return null;

  const toggleReveal = (questionIndex: number) => {
    setRevealedAnswers(prev => {
      const next = new Set(prev);
      if (next.has(questionIndex)) {
        next.delete(questionIndex);
      } else {
        next.add(questionIndex);
      }
      return next;
    });
  };

  const selectAnswer = (questionIndex: number, optionIndex: number) => {
    setSelectedAnswers(prev => {
      const next = new Map(prev);
      next.set(questionIndex, optionIndex);
      return next;
    });
    // Auto-reveal answer after selection
    setRevealedAnswers(prev => new Set(prev).add(questionIndex));
  };

  return (
    <BlockWrapper
      blockId={block.blockId}
      label={BLOCK_LABELS.quiz}
      variant="card"
      headerIcon={<HelpCircle className="h-4 w-4" />}
      headerLabel={BLOCK_LABELS.quiz}
    >
      <div className="space-y-4">
        <div className="space-y-6">
          {questions.map((question, qIndex) => {
            const isRevealed = revealedAnswers.has(qIndex);
            const selectedOption = selectedAnswers.get(qIndex);
            const isCorrect = selectedOption === question.correctIndex;

            return (
              <div key={qIndex} className="rounded-lg border border-border/50 overflow-hidden">
                {/* Question */}
                <div className="bg-muted/30 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-primary/30 tabular-nums" aria-hidden="true">{qIndex + 1}</span>
                    <div>
                      <span className="text-xs text-muted-foreground/70">
                        {BLOCK_LABELS.question} {qIndex + 1}
                      </span>
                      <p className="font-medium text-sm mt-0.5"><ConceptHighlighter text={question.question} /></p>
                    </div>
                  </div>
                </div>

                {/* Options */}
                <div className="p-4 space-y-2">
                  {question.options.map((option, oIndex) => {
                    const isSelected = selectedOption === oIndex;
                    const isCorrectOption = oIndex === question.correctIndex;
                    const showResult = isRevealed && isSelected;

                    return (
                      <button
                        key={oIndex}
                        type="button"
                        onClick={() => !isRevealed && selectAnswer(qIndex, oIndex)}
                        disabled={isRevealed}
                        className={cn(
                          'w-full text-left px-3 py-2 rounded-md text-sm transition-all duration-150',
                          'border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                          !isRevealed && 'hover-scale',
                          isRevealed && isCorrectOption && 'bg-success-soft border-success/50 glow-success',
                          showResult && !isCorrect && 'bg-destructive/10 border-destructive/50',
                          !isRevealed && 'border-border/50 hover:bg-muted/50',
                          !isRevealed && isSelected && 'bg-primary/10 border-primary/50'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs shrink-0 font-medium',
                            isRevealed && isCorrectOption && 'border-success text-success',
                            showResult && !isCorrect && 'border-destructive text-destructive',
                            !isRevealed && 'border-border'
                          )}>
                            {String.fromCharCode(65 + oIndex)}
                          </span>
                          <span className="flex-1">{option}</span>
                          {isRevealed && isCorrectOption && (
                            <CheckCircle2 className="h-4 w-4 text-success shrink-0" aria-hidden="true" />
                          )}
                          {showResult && !isCorrect && (
                            <XCircle className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Explanation */}
                {isRevealed && question.explanation && (
                  <div className="px-4 pb-4">
                    <div className="bg-muted/30 rounded-md p-3 text-sm">
                      <span className="font-medium text-xs text-muted-foreground block mb-1">
                        {BLOCK_LABELS.explanation}
                      </span>
                      <p className="text-muted-foreground"><ConceptHighlighter text={question.explanation} /></p>
                    </div>
                  </div>
                )}

                {/* Show/Hide Answer button */}
                {!selectedOption && (
                  <div className="px-4 pb-4">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleReveal(qIndex)}
                      className="gap-1.5 text-xs"
                    >
                      {isRevealed ? (
                        <>
                          <ChevronUp className="h-3 w-3" />
                          {BLOCK_LABELS.hideAnswer}
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3" />
                          {BLOCK_LABELS.showAnswer}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </BlockWrapper>
  );
});
