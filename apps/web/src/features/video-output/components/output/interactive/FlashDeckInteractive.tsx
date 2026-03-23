import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Shuffle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { FlashcardItem } from '@vie/types';
import { GlassCard, FadeIn, BackForward, Stepper, Badge, ProgressBar } from '@/components/vie';
import { Celebration } from '../Celebration';

import { useTabState } from '@/features/video-output/contexts/TabStateContext';
import { useTabCoordination } from '../TabCoordinationContext';

interface FlashDeckInteractiveProps {
  cards: FlashcardItem[];
  shuffleable?: boolean;
  tabId?: string;
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

export const FlashDeckInteractive = memo(function FlashDeckInteractive({
  cards: initialCards,
  shuffleable,
  tabId = 'flashcards',
  nextTab,
  onNavigateTab,
}: FlashDeckInteractiveProps) {
  const tabState = useTabState();
  const tabCoord = useTabCoordination();
  const [shuffleIndices, setShuffleIndices] = useState<number[] | null>(null);
  const cards = useMemo(
    () => shuffleIndices ? shuffleIndices.map((i) => initialCards[i]).filter(Boolean) : initialCards,
    [initialCards, shuffleIndices],
  );
  const [currentCard, setCurrentCard] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());
  const [reviewed, setReviewed] = useState<Set<number>>(new Set());

  const handleFlip = useCallback(() => {
    setFlipped((prev) => {
      if (!prev) setReviewed((s) => new Set(s).add(currentCard));
      return !prev;
    });
  }, [currentCard]);

  const goTo = useCallback((index: number) => {
    setFlipped(false);
    setCurrentCard(index);
  }, []);

  const markKnown = useCallback(() => {
    setKnown((prev) => new Set(prev).add(currentCard));
    setReviewed((prev) => new Set(prev).add(currentCard));
    tabState.masterCard(String(currentCard));
    // Auto-advance to next unreviewed
    const nextUnreviewed = cards.findIndex((_, i) => i > currentCard && !known.has(i));
    if (nextUnreviewed !== -1) goTo(nextUnreviewed);
    else if (currentCard < cards.length - 1) goTo(currentCard + 1);
  }, [currentCard, cards, known, goTo, tabState]);

  const markReview = useCallback(() => {
    setKnown((prev) => {
      const next = new Set(prev);
      next.delete(currentCard);
      return next;
    });
    setReviewed((prev) => new Set(prev).add(currentCard));
    if (currentCard < cards.length - 1) goTo(currentCard + 1);
  }, [currentCard, cards.length, goTo]);

  const handleShuffle = useCallback(() => {
    const indices = initialCards.map((_, i) => i);
    // Fisher-Yates shuffle for uniform distribution
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setShuffleIndices(indices);
    setCurrentCard(0);
    setFlipped(false);
    setKnown(new Set());
    setReviewed(new Set());
  }, [initialCards]);

  const allReviewed = cards.length > 0 && reviewed.size === cards.length;

  // Mark tab completed when all cards reviewed
  useEffect(() => {
    if (allReviewed) tabCoord?.markTabCompleted(tabId);
  }, [allReviewed, tabCoord, tabId]);

  // Read quiz results for review flags
  const cardNeedsReview = useMemo(() => {
    if (tabState.quizResults.size === 0) return new Set<number>();
    const needsReview = new Set<number>();
    // Match card indices to quiz results by index (simplified matching)
    tabState.quizResults.forEach((correct, qIdx) => {
      if (!correct) {
        const idx = parseInt(qIdx, 10);
        if (!isNaN(idx) && idx < cards.length) needsReview.add(idx);
      }
    });
    return needsReview;
  }, [tabState.quizResults, cards.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        handleFlip();
      } else if (e.key === 'ArrowRight' && flipped) {
        markKnown();
      } else if (e.key === 'ArrowLeft' && flipped) {
        markReview();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleFlip, flipped, markKnown, markReview]);

  // Touch swipe handling
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    const SWIPE_THRESHOLD = 50;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    if (delta > 0) {
      // Swipe right
      if (flipped) markKnown();
      else handleFlip();
    } else {
      // Swipe left
      if (flipped) markReview();
      else handleFlip();
    }
  }, [flipped, handleFlip, markKnown, markReview]);

  if (cards.length === 0) return null;

  const card = cards[currentCard];

  return (
    <GlassCard className="space-y-4">
      {/* Header with counter + shuffle */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground/70">
          {currentCard + 1} of {cards.length}
        </span>
        <div className="flex items-center gap-2">
          {reviewed.size > 0 && (
            <span className="text-xs text-muted-foreground">
              {known.size} known / {reviewed.size - known.size} review
            </span>
          )}
          {shuffleable && (
            <Button variant="ghost" size="icon-sm" onClick={handleShuffle} aria-label="Shuffle cards">
              <Shuffle className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar showing reviewed/total */}
      <ProgressBar value={reviewed.size} max={cards.length} label="Cards reviewed" />

      {/* 3D flip card */}
      <FadeIn key={currentCard}>
        <div
          className="relative cursor-pointer"
          style={{ perspective: '1000px' }}
          onClick={handleFlip}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          role="button"
          tabIndex={0}
          aria-label={flipped ? card.back : card.front}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleFlip();
            }
          }}
        >
          <div
            className="relative w-full transition-transform duration-500"
            style={{
              transformStyle: 'preserve-3d',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              minHeight: '180px',
            }}
          >
            {/* Front */}
            <div
              className={cn(
                'absolute inset-0 flex flex-col items-center justify-center',
                'rounded-lg border border-border/50 bg-muted/20 p-6 text-center',
              )}
              style={{ backfaceVisibility: 'hidden' }}
            >
              {card.category && (
                <Badge variant="muted" className="mb-2 text-[10px] uppercase tracking-wide">
                  {card.category}
                </Badge>
              )}
              {card.emoji && <span className="text-3xl mb-3" aria-hidden="true">{card.emoji}</span>}
              <p className="font-medium text-sm">{card.front}</p>
              {cardNeedsReview.has(currentCard) && (
                <Badge variant="warning" className="mt-2 text-[10px]">
                  {'🔄'} Missed in quiz
                </Badge>
              )}
              <span className="text-xs text-muted-foreground/50 mt-3">Tap to flip</span>
            </div>

            {/* Back */}
            <div
              className={cn(
                'absolute inset-0 flex flex-col items-center justify-center',
                'rounded-lg border border-primary/30 bg-primary/5 p-6 text-center',
              )}
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              <p className="text-sm text-muted-foreground">{card.back}</p>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Known / Review buttons (shown after flip) */}
      {flipped && !known.has(currentCard) && (
        <FadeIn>
          <div className="flex items-center gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={markReview} className="text-xs gap-1.5">
              Review again
            </Button>
            <Button variant="default" size="sm" onClick={markKnown} className="text-xs gap-1.5">
              Got it!
            </Button>
          </div>
        </FadeIn>
      )}

      {/* Navigation */}
      {cards.length > 1 && (
        <BackForward
          onBack={() => goTo(currentCard - 1)}
          onForward={() => goTo(currentCard + 1)}
          backDisabled={currentCard === 0}
          forwardDisabled={currentCard === cards.length - 1}
        />
      )}

      {/* Stepper dots */}
      {cards.length > 1 && (
        <Stepper
          total={cards.length}
          current={currentCard}
          completedSteps={known}
          onStepClick={goTo}
        />
      )}

      {/* Celebration */}
      {allReviewed && (
        <Celebration
          emoji="🃏"
          title={known.size === cards.length ? 'All mastered!' : 'All cards reviewed!'}
          subtitle={`${known.size} known, ${cards.length - known.size} to review`}
          nextTabId={nextTab}
          nextLabel={nextTab ? 'Continue' : undefined}
          onNavigateTab={onNavigateTab}
        />
      )}

    </GlassCard>
  );
});
