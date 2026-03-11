import { memo, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BlockWrapper } from './BlockWrapper';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface Card {
  front: string;
  back: string;
  emoji?: string;
  category?: string;
}

interface FlashCardProps {
  cards: Card[];
}

/**
 * Flip card component for learning content.
 * CSS 3D transform with rotateY(180deg), prev/next navigation,
 * and progress dots tracking which cards have been flipped.
 */
export const FlashCard = memo(function FlashCard({ cards }: FlashCardProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());

  const handleFlip = useCallback(() => {
    setFlipped(prev => {
      if (!prev) {
        setFlippedCards(s => new Set(s).add(activeIndex));
      }
      return !prev;
    });
  }, [activeIndex]);

  const goTo = useCallback((index: number) => {
    setFlipped(false);
    setActiveIndex(index);
  }, []);

  if (cards.length === 0) return null;

  const card = cards[activeIndex];

  return (
    <BlockWrapper
      blockId={undefined}
      label={BLOCK_LABELS.flashCards}
      variant="card"
      headerIcon={<Layers className="h-4 w-4" />}
      headerLabel={BLOCK_LABELS.flashCards}
    >
      <div className="space-y-4">
        {/* Counter */}
        {cards.length > 1 && (
          <div className="text-xs text-muted-foreground/70 text-center">
            {activeIndex + 1} {BLOCK_LABELS.of} {cards.length}
          </div>
        )}

        {/* Card with 3D flip */}
        <div
          className="relative cursor-pointer"
          style={{ perspective: '1000px' }}
          onClick={handleFlip}
          role="button"
          tabIndex={0}
          aria-label={flipped ? card.back : card.front}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFlip(); } }}
        >
          <div
            className="relative w-full transition-transform duration-500"
            style={{
              transformStyle: 'preserve-3d',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              minHeight: '160px',
            }}
          >
            {/* Front face */}
            <div
              className={cn(
                'absolute inset-0 flex flex-col items-center justify-center',
                'rounded-lg border border-border/50 bg-muted/20 p-6 text-center',
              )}
              style={{ backfaceVisibility: 'hidden' }}
            >
              {card.emoji && (
                <span className="text-3xl mb-3" aria-hidden="true">{card.emoji}</span>
              )}
              {card.category && (
                <span className="text-xs text-muted-foreground/70 mb-2 uppercase tracking-wide">
                  {card.category}
                </span>
              )}
              <p className="font-medium text-sm">{card.front}</p>
              <span className="text-xs text-muted-foreground/50 mt-3">
                {BLOCK_LABELS.tapToFlip}
              </span>
            </div>

            {/* Back face */}
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
              onClick={() => goTo(activeIndex - 1)}
              disabled={activeIndex === 0}
              className="gap-1 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => goTo(activeIndex + 1)}
              disabled={activeIndex === cards.length - 1}
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
                  index === activeIndex
                    ? 'bg-primary'
                    : flippedCards.has(index)
                      ? 'bg-success/60'
                      : 'bg-muted-foreground/20'
                )}
              />
            ))}
          </div>
        )}
      </div>
    </BlockWrapper>
  );
});
