import { useState } from 'react';
import type { StudyKitOutput, EnrichmentData } from '@vie/types';
import { GlassCard } from '../GlassCard';
import { cn } from '../../../../lib/utils';

interface StudyTabsProps {
  data: StudyKitOutput;
  enrichment?: EnrichmentData;
  activeTab: string;
}

export function StudyTabs({ data, enrichment, activeTab }: StudyTabsProps) {
  switch (activeTab) {
    case 'overview':
      return (
        <div className="flex flex-col gap-4">
          {/* Key question */}
          <GlassCard variant="elevated" className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Key Question</p>
            <p className="text-lg font-semibold leading-snug">{data.keyQuestion}</p>
          </GlassCard>
          {/* Summary */}
          <GlassCard>
            <p className="text-sm leading-relaxed">{data.summary}</p>
          </GlassCard>
          {/* Key facts */}
          {data.keyFacts.length > 0 && (
            <GlassCard>
              <h4 className="text-sm font-semibold mb-3">Key Facts</h4>
              <ul className="flex flex-col gap-2">
                {data.keyFacts.map((fact, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="shrink-0 text-primary">{'\u2022'}</span>
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}
          {/* Timeline */}
          {data.timeline.length > 0 && (
            <GlassCard>
              <h4 className="text-sm font-semibold mb-3">Timeline</h4>
              <div className="flex flex-col gap-3 border-l-2 border-primary/20 pl-4">
                {data.timeline.map((event, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                    {event.date && (
                      <span className="text-xs font-medium text-primary">{event.date}</span>
                    )}
                    <h5 className="text-sm font-semibold">{event.title}</h5>
                    <p className="text-xs text-muted-foreground">{event.description}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      );

    case 'concepts':
      return <ConceptCards concepts={data.concepts} />;

    case 'flashcards':
      return <FlashcardList flashcards={enrichment?.flashcards ?? []} />;

    case 'quiz':
      return <QuizCards questions={enrichment?.quiz ?? []} />;

    default:
      return null;
  }
}

/** Expandable concept cards */
function ConceptCards({ concepts }: { concepts: StudyKitOutput['concepts'] }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {concepts.map((concept, i) => {
        const isExpanded = expandedIdx === i;
        return (
          <GlassCard key={i} variant="interactive" className="cursor-pointer">
            <button
              className="flex w-full items-start gap-3 text-left"
              onClick={() => setExpandedIdx(isExpanded ? null : i)}
              aria-expanded={isExpanded}
            >
              <span className="text-2xl shrink-0">{concept.emoji}</span>
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <h4 className="text-sm font-semibold">{concept.name}</h4>
                <p className="text-sm text-muted-foreground">{concept.definition}</p>
                {isExpanded && (
                  <div className="mt-2 flex flex-col gap-2 animate-[fadeUp_0.2s_ease_both]">
                    {concept.example && (
                      <div className="rounded-lg bg-muted/50 p-3">
                        <span className="text-xs font-medium text-muted-foreground">Example</span>
                        <p className="text-sm mt-1">{concept.example}</p>
                      </div>
                    )}
                    {concept.analogy && (
                      <div className="rounded-lg bg-muted/50 p-3">
                        <span className="text-xs font-medium text-muted-foreground">Analogy</span>
                        <p className="text-sm mt-1">{concept.analogy}</p>
                      </div>
                    )}
                    {concept.connections.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {concept.connections.map((conn) => (
                          <span key={conn} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            {conn}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </button>
          </GlassCard>
        );
      })}
    </div>
  );
}

/** Flip-style flashcards */
function FlashcardList({ flashcards }: { flashcards: NonNullable<EnrichmentData['flashcards']> }) {
  const [flippedIdx, setFlippedIdx] = useState<number | null>(null);

  if (flashcards.length === 0) {
    return (
      <GlassCard className="text-center py-8">
        <p className="text-sm text-muted-foreground">No flashcards available for this content.</p>
      </GlassCard>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {flashcards.map((card, i) => {
        const isFlipped = flippedIdx === i;
        return (
          <GlassCard
            key={i}
            variant="interactive"
            className={cn('cursor-pointer min-h-[120px] flex items-center justify-center text-center', isFlipped && 'bg-primary/5')}
          >
            <button
              className="flex w-full items-center justify-center p-2"
              onClick={() => setFlippedIdx(isFlipped ? null : i)}
              aria-label={isFlipped ? 'Show question' : 'Show answer'}
            >
              {isFlipped ? (
                <div className="animate-[fadeUp_0.2s_ease_both]">
                  <span className="text-xs text-muted-foreground mb-1 block">Answer</span>
                  <p className="text-sm font-medium">{card.back}</p>
                </div>
              ) : (
                <div>
                  <span className="text-xs text-muted-foreground mb-1 block">Question</span>
                  <p className="text-sm font-semibold">{card.front}</p>
                </div>
              )}
            </button>
          </GlassCard>
        );
      })}
    </div>
  );
}

/** Sequential quiz cards */
function QuizCards({ questions }: { questions: NonNullable<EnrichmentData['quiz']> }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  if (questions.length === 0) {
    return (
      <GlassCard className="text-center py-8">
        <p className="text-sm text-muted-foreground">No quiz questions available for this content.</p>
      </GlassCard>
    );
  }

  const q = questions[currentIdx];
  const isCorrect = selectedOption === q.correctIndex;

  function handleSelect(optionIdx: number) {
    if (showAnswer) return;
    setSelectedOption(optionIdx);
    setShowAnswer(true);
  }

  function handleNext() {
    setSelectedOption(null);
    setShowAnswer(false);
    setCurrentIdx((prev) => Math.min(prev + 1, questions.length - 1));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Question {currentIdx + 1} of {questions.length}</span>
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 w-6 rounded-full',
                i === currentIdx ? 'bg-primary' : i < currentIdx ? 'bg-primary/30' : 'bg-muted',
              )}
            />
          ))}
        </div>
      </div>

      {/* Question */}
      <GlassCard variant="elevated">
        <p className="text-sm font-semibold mb-4">{q.question}</p>
        <div className="flex flex-col gap-2">
          {q.options.map((option, i) => (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={showAnswer}
              className={cn(
                'w-full rounded-lg border px-4 py-3 text-left text-sm transition-all',
                showAnswer && i === q.correctIndex && 'border-green-500 bg-green-500/10',
                showAnswer && selectedOption === i && !isCorrect && 'border-red-500 bg-red-500/10',
                !showAnswer && 'border-border hover:border-primary/50 hover:bg-muted/50',
              )}
            >
              {option}
            </button>
          ))}
        </div>
        {showAnswer && (
          <div className="mt-3 animate-[fadeUp_0.2s_ease_both]">
            <p className={cn('text-sm font-medium', isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
              {isCorrect ? 'Correct!' : 'Not quite.'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{q.explanation}</p>
            {currentIdx < questions.length - 1 && (
              <button
                onClick={handleNext}
                className="mt-3 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground"
              >
                Next Question
              </button>
            )}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
