import { memo } from 'react';
import { cn } from '@/lib/utils';

interface QuoteBlockProps {
  text: string;
  attribution?: string;
  variant?: 'speaker' | 'testimonial' | 'highlight';
  className?: string;
}

export const QuoteBlock = memo(function QuoteBlock({
  text,
  attribution,
  variant = 'speaker',
  className,
}: QuoteBlockProps) {
  const isHighlight = variant === 'highlight';

  return (
    <div
      className={cn(
        'relative overflow-hidden animate-fade-up',
        isHighlight && 'bg-info-soft/20 px-3 py-2 rounded',
        className,
      )}
    >
      {!isHighlight && (
        <span
          className="quote-decorative-mark animate-pop-in"
          style={{ animationDelay: '80ms' }}
          aria-hidden="true"
        >
          "
        </span>
      )}
      <blockquote className={isHighlight ? 'font-medium text-sm' : 'italic text-base'}>
        {/* Use font-display (Bricolage Grotesque) for editorial voice without
            falling back to Times New Roman via the generic `font-serif` stack.
            Italic Bricolage reads as quoted speech while staying on-brand. */}
        <p
          className="text-foreground leading-relaxed max-w-prose text-pretty"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {text}
        </p>
      </blockquote>
      {attribution && (
        <>
          <div className="fade-divider my-2" aria-hidden="true" />
          <footer>
            <cite className="text-xs font-medium tracking-wide text-muted-foreground not-italic">
              — {attribution}
            </cite>
          </footer>
        </>
      )}
    </div>
  );
});
