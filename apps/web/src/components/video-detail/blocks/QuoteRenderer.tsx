import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { QuoteBlock } from '@vie/types';
import { Star, Play } from 'lucide-react';

interface QuoteRendererProps {
  block: QuoteBlock;
  onSeek?: (seconds: number) => void;
}

// Variant configuration with type safety
const VARIANT_CONFIG = {
  speaker: {
    containerClass: 'border-l-2 border-primary/40 pl-4',
    textClass: 'italic text-base',
    showStar: false,
  },
  testimonial: {
    containerClass: 'border-l-2 border-amber-400/50 pl-4',
    textClass: 'italic text-base',
    showStar: true,
  },
  highlight: {
    containerClass: 'bg-yellow-500/5 dark:bg-yellow-500/10 px-3 py-2 rounded',
    textClass: 'font-medium text-sm',
    showStar: false,
  },
} as const;

type VariantKey = keyof typeof VARIANT_CONFIG;

/**
 * Renders a quote block with variant-specific styling.
 * Variants: speaker (default), testimonial (star icon), highlight (bold, no quotes)
 */
export const QuoteRenderer = memo(function QuoteRenderer({ block, onSeek }: QuoteRendererProps) {
  const variant = block.variant || 'speaker';

  // Safe lookup with fallback to 'speaker' for unknown variants
  const config = VARIANT_CONFIG[variant as VariantKey] ?? VARIANT_CONFIG.speaker;

  const handleSeek = () => {
    if (onSeek && block.timestamp !== undefined) {
      onSeek(block.timestamp);
    }
  };

  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={config.containerClass}>
      {/* Quote text */}
      <blockquote className={config.textClass}>
        <p className="text-foreground leading-relaxed">{block.text}</p>
      </blockquote>

      {/* Attribution and timestamp */}
      {(block.attribution || block.timestamp !== undefined) && (
        <footer className="mt-2 flex items-center gap-3">
          {block.attribution && (
            <cite className="flex items-center gap-1.5 text-sm text-muted-foreground not-italic">
              {config.showStar && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
              — {block.attribution}
            </cite>
          )}

          {block.timestamp !== undefined && (
            <button
              type="button"
              onClick={handleSeek}
              disabled={!onSeek}
              className={cn(
                'inline-flex items-center gap-1 text-xs',
                'font-mono transition-colors',
                onSeek
                  ? 'cursor-pointer text-primary hover:underline focus:outline-none'
                  : 'cursor-default text-muted-foreground'
              )}
              aria-label={
                block.attribution
                  ? `Jump to ${formatTimestamp(block.timestamp)} - ${block.attribution}`
                  : `Jump to ${formatTimestamp(block.timestamp)}`
              }
            >
              <Play className="h-3 w-3 fill-current" />
              {formatTimestamp(block.timestamp)}
            </button>
          )}
        </footer>
      )}
    </div>
  );
});
