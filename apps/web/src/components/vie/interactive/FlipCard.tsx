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
 * Domain-free 3D flip card. Pure CSS transform + transition, no motion runtime.
 * Click / Enter / Space to flip.
 */
export const FlipCard = memo(function FlipCard({
  front,
  back,
  emoji,
  category,
  className,
}: FlipCardProps) {
  const [flipped, setFlipped] = useState<boolean>(false);
  const toggle = useCallback(() => setFlipped((p) => !p), []);

  return (
    <div
      className={cn(
        'relative cursor-pointer rounded-xl outline-none [perspective:1200px] active:scale-[0.98] transition-transform duration-150',
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
      onClick={toggle}
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label={`Flashcard — ${flipped ? `back: ${back}` : `front: ${front}. Activate to reveal answer.`}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      }}
    >
      <div
        className={cn(
          'relative w-full [transform-style:preserve-3d] transition-transform duration-[500ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
          flipped && '[transform:rotateY(180deg)]',
        )}
        style={{ minHeight: '160px' }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border border-border/50 bg-muted/20 p-6 text-center shadow-[0_6px_20px_-8px_oklch(from_var(--foreground)_l_c_h_/_0.12)] [backface-visibility:hidden]"
        >
          {emoji && (
            <span className="text-3xl mb-3 leading-none animate-float" aria-hidden="true">
              {emoji}
            </span>
          )}
          {category && (
            <span className="text-[0.6875rem] font-semibold text-muted-foreground/80 mb-2 uppercase tracking-[0.12em] leading-none">
              {category}
            </span>
          )}
          <p className="text-[0.9375rem] font-semibold leading-tight text-balance">{front}</p>
          <span className="text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-muted-foreground/70 mt-3 leading-none">
            Tap to flip
          </span>
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border border-primary/40 bg-[oklch(from_var(--primary)_l_c_h_/_0.08)] p-6 text-center shadow-[0_8px_24px_-8px_oklch(from_var(--primary)_l_c_h_/_0.25)] [backface-visibility:hidden] [transform:rotateY(180deg)]"
        >
          <p className="text-[0.9375rem] leading-relaxed text-pretty text-foreground/90 max-w-prose">{back}</p>
        </div>
      </div>
    </div>
  );
});
