import { memo, useCallback, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { FlashcardItem } from '@vie/types';
import { GlassCard } from '../GlassCard';
import { Celebration } from '../Celebration';
import { CrossTabLink } from '../CrossTabLink';

interface FlashDeckInteractiveProps {
  cards: FlashcardItem[];
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

export const FlashDeckInteractive = memo(function FlashDeckInteractive({
  cards,
  nextTab,
  onNavigateTab,
}: FlashDeckInteractiveProps) {
  const [currentCard, setCurrentCard] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState<Set<number>>(new Set());

  const handleFlip = useCallback(() => {
    setFlipped((prev) => {
      if (!prev) {
        setReviewed((s) => new Set(s).add(currentCard));
      }
      return !prev;
    });
  }, [currentCard]);

  const goTo = useCallback((index: number) => {
    setFlipped(false);
    setCurrentCard(index);
  }, []);

  const allReviewed = cards.length > 0 && reviewed.size === cards.length;

  if (cards.length === 0) return null;

  const card = cards[currentCard];

  return (
    <GlassCard className="space-y-4">
      {/* Counter */}
      {cards.length > 1 && (
        <div className="text-xs text-muted-foreground/70 text-center">
          {currentCard + 1} of {cards.length}
        </div>
      )}

      {/* 3D flip card */}
      <div
        className="relative cursor-pointer"
        style={{ perspective: '1000px' }}
        onClick={handleFlip}
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
              <span className="text-xs text-muted-foreground/70 mb-2 uppercase tracking-wide bg-muted/30 px-2 py-0.5 rounded-full">
                {card.category}
              </span>
            )}
            {card.emoji && (
              <span className="text-3xl mb-3" aria-hidden="true">{card.emoji}</span>
            )}
            <p className="font-medium text-sm">{card.front}</p>
            <span className="text-xs text-muted-foreground/50 mt-3">Tap to flip</span>
          </div>

          {/* Back */}
          <div
            className={cn(
              'absolute inset-0 flex flex-col items-center justify-center',
              'rounded-lg border border-primary/30 bg-primary/5 p-6 text-center',
            )}
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <p className="text-sm text-muted-foreground">{card.back}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      {cards.length > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => goTo(currentCard - 1)}
            disabled={currentCard === 0}
            className="gap-1 text-xs"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => goTo(currentCard + 1)}
            disabled={currentCard === cards.length - 1}
            className="gap-1 text-xs"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Progress dots */}
      {cards.length > 1 && (
        <div className="flex justify-center gap-1.5" aria-label="Card progress">
          {cards.map((_, index) => (
            <div
              key={index}
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                index === currentCard
                  ? 'bg-primary'
                  : reviewed.has(index)
                    ? 'bg-success/60'
                    : 'bg-muted-foreground/20',
              )}
            />
          ))}
        </div>
      )}

      {/* Celebration */}
      {allReviewed && (
        <Celebration
          emoji="🃏"
          title="All cards reviewed!"
          subtitle={`${cards.length} cards completed`}
          nextTabId={nextTab}
          nextLabel={nextTab ? 'Continue' : undefined}
          onNavigateTab={onNavigateTab}
        />
      )}

      {/* Cross-tab link */}
      {!allReviewed && nextTab && onNavigateTab && (
        <CrossTabLink tabId={nextTab} label="Continue" onNavigate={onNavigateTab} />
      )}
    </GlassCard>
  );
});
