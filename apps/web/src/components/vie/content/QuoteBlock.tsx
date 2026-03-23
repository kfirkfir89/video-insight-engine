import { memo } from 'react';
import { cn } from '@/lib/utils';

interface QuoteBlockProps {
  text: string;
  attribution?: string;
  variant?: 'speaker' | 'testimonial' | 'highlight';
  className?: string;
}

/**
 * Domain-free quote display.
 * No timestamp, no copy, no @vie/types — pure presentation.
 */
export const QuoteBlock = memo(function QuoteBlock({
  text,
  attribution,
  variant = 'speaker',
  className,
}: QuoteBlockProps) {
  const isHighlight = variant === 'highlight';

  return (
    <div className={cn('relative overflow-hidden', isHighlight && 'bg-info-soft/20 px-3 py-2 rounded', className)}>
      {!isHighlight && (
        <span className="quote-decorative-mark" aria-hidden="true">"</span>
      )}
      <blockquote className={isHighlight ? 'font-medium text-sm' : 'italic text-base'}>
        <p className="text-foreground leading-relaxed font-serif">{text}</p>
      </blockquote>
      {attribution && (
        <>
          <div className="fade-divider my-2" aria-hidden="true" />
          <footer>
            <cite className="text-sm text-muted-foreground not-italic">— {attribution}</cite>
          </footer>
        </>
      )}
    </div>
  );
});
