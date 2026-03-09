import { memo, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { QuoteBlock } from '@vie/types';
import { Star, Play, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BlockWrapper } from './BlockWrapper';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface QuoteRendererProps {
  block: QuoteBlock;
  onSeek?: (seconds: number) => void;
}

// Variant configuration with type safety
const VARIANT_CONFIG = {
  speaker: {
    textClass: 'italic text-base',
    showStar: false,
  },
  testimonial: {
    textClass: 'italic text-base',
    showStar: true,
  },
  highlight: {
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
  const [copied, setCopied] = useState(false);
  const variant = block.variant || 'speaker';

  // Safe lookup with fallback to 'speaker' for unknown variants
  const config = VARIANT_CONFIG[variant as VariantKey] ?? VARIANT_CONFIG.speaker;

  const handleSeek = () => {
    if (onSeek && block.timestamp !== undefined) {
      onSeek(block.timestamp);
    }
  };

  const handleCopy = useCallback(async () => {
    const text = block.attribution
      ? `"${block.text}" — ${block.attribution}`
      : `"${block.text}"`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in non-HTTPS or restricted contexts
    }
  }, [block.text, block.attribution]);

  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Highlight variant uses transparent wrapper with its own bg styling
  const isHighlight = variant === 'highlight';

  return (
    <BlockWrapper
      blockId={block.blockId}
      variant="transparent"
      label="Quote"
    >
      <div className={cn('group/quote relative overflow-hidden', isHighlight ? 'bg-info-soft/20 px-3 py-2 rounded' : undefined)}>
        {/* Decorative large quote mark */}
        {!isHighlight && (
          <span className="quote-decorative-mark" aria-hidden="true">"</span>
        )}

        {/* Quote text */}
        <blockquote className={config.textClass}>
          <p className="text-foreground leading-relaxed font-serif">{block.text}</p>
        </blockquote>

        {/* Attribution and timestamp */}
        {(block.attribution || block.timestamp !== undefined) && (
          <>
            <div className="fade-divider my-2" aria-hidden="true" />
            <footer className="flex items-center gap-3">
              {block.attribution && (
                <cite className="flex items-center gap-1.5 text-sm text-muted-foreground not-italic">
                  {config.showStar && <Star className="h-3.5 w-3.5 shrink-0 fill-warning text-warning" aria-hidden="true" />}
                  — {block.attribution}
                </cite>
              )}

              {block.timestamp !== undefined && (
                <Button
                  variant="ghost"
                  size="bare"
                  onClick={handleSeek}
                  disabled={!onSeek}
                  className={cn(
                    'text-xs font-mono transition-colors',
                    onSeek
                      ? 'cursor-pointer text-primary hover:underline'
                      : 'cursor-default text-muted-foreground'
                  )}
                  aria-label={
                    block.attribution
                      ? `Jump to ${formatTimestamp(block.timestamp)} - ${block.attribution}`
                      : `Jump to ${formatTimestamp(block.timestamp)}`
                  }
                >
                  <Play className="h-3.5 w-3.5 shrink-0 fill-current" aria-hidden="true" />
                  {formatTimestamp(block.timestamp)}
                </Button>
              )}

              {/* Copy quote button - visible on hover */}
              <Button
                variant="ghost"
                size="bare"
                onClick={handleCopy}
                className={cn(
                  'ml-auto text-xs px-1.5 py-0.5 transition-all duration-150',
                  'opacity-0 group-hover/quote:opacity-100 focus:opacity-100',
                  'hover:bg-muted/20',
                  copied ? 'text-success opacity-100' : 'text-muted-foreground'
                )}
                aria-label={copied ? BLOCK_LABELS.copied : BLOCK_LABELS.copyQuote}
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" aria-hidden="true" />
                    <span>{BLOCK_LABELS.copied}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" aria-hidden="true" />
                    <span>{BLOCK_LABELS.copyQuote}</span>
                  </>
                )}
              </Button>
            </footer>
          </>
        )}
      </div>
    </BlockWrapper>
  );
});
