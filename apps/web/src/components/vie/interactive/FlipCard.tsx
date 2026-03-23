import { memo, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface FlipCardProps {
  front: string;
  back: string;
  emoji?: string;
  category?: string;
  className?: string;
}

/**
 * Single 3D flip card. Domain-free primitive.
 * Click/Enter/Space to flip.
 */
export const FlipCard = memo(function FlipCard({
  front,
  back,
  emoji,
  category,
  className,
}: FlipCardProps) {
  const [flipped, setFlipped] = useState(false);

  const toggle = useCallback(() => setFlipped((p) => !p), []);

  return (
    <div
      className={cn('relative cursor-pointer', className)}
      style={{ perspective: '1000px' }}
      onClick={toggle}
      role="button"
      tabIndex={0}
      aria-label={flipped ? back : front}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      }}
    >
      <div
        className="relative w-full transition-transform duration-500"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          minHeight: '160px',
        }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center rounded-lg border border-border/50 bg-muted/20 p-6 text-center"
          style={{ backfaceVisibility: 'hidden' }}
        >
          {emoji && <span className="text-3xl mb-3" aria-hidden="true">{emoji}</span>}
          {category && (
            <span className="text-xs text-muted-foreground/70 mb-2 uppercase tracking-wide">{category}</span>
          )}
          <p className="font-medium text-sm">{front}</p>
          <span className="text-xs text-muted-foreground/50 mt-3">Tap to flip</span>
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center rounded-lg border border-primary/30 bg-primary/5 p-6 text-center"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <p className="text-sm text-muted-foreground">{back}</p>
        </div>
      </div>
    </div>
  );
});
