import { memo, useState, useCallback } from 'react';
import type { StatisticBlock } from '@vie/types';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BlockWrapper } from './BlockWrapper';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface StatisticRendererProps {
  block: StatisticBlock;
}

// Extracted outside component to avoid recreation on each render
function TrendIcon({ trend }: { trend?: 'up' | 'down' | 'neutral' }) {
  switch (trend) {
    case 'up':
      return <TrendingUp className="h-3.5 w-3.5 shrink-0 text-success dark:drop-shadow-[0_0_4px_currentColor]" aria-hidden="true" />;
    case 'down':
      return <TrendingDown className="h-3.5 w-3.5 shrink-0 text-destructive dark:drop-shadow-[0_0_4px_currentColor]" aria-hidden="true" />;
    case 'neutral':
      return <Minus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />;
    default:
      return null;
  }
}

/**
 * Renders a statistic block with inline metrics.
 * Click any stat value to copy it.
 * Variants: metric (default), percentage, trend
 */
export const StatisticRenderer = memo(function StatisticRenderer({ block }: StatisticRendererProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = useCallback(async (label: string, value: string, index: number) => {
    const text = `${label}: ${value}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // Clipboard API may fail in non-HTTPS or restricted contexts
    }
  }, []);

  return (
    <BlockWrapper
      blockId={block.blockId}
      variant="transparent"
      label="Statistics"
    >
      <div className="flex flex-wrap items-center gap-0">
        {block.items.map((item, index) => (
          <div key={index} className="flex items-center" style={{ animation: 'var(--animate-counter-pop)', animationDelay: `${index * 100}ms` }}>
            <Button
              variant="ghost"
              size="bare"
              onClick={() => handleCopy(item.label, item.value, index)}
              className="flex-col items-center text-center px-4 py-2 rounded-md transition-colors cursor-pointer hover:bg-muted/20"
              aria-label={copiedIndex === index ? BLOCK_LABELS.copied : `${BLOCK_LABELS.copyValue}: ${item.label}: ${item.value}`}
            >
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black tabular-nums text-gradient-primary">{item.value}</span>
                {item.trend && <TrendIcon trend={item.trend} />}
              </div>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground mt-1">{item.label}</span>
              {item.context && (
                <span className="text-xs text-muted-foreground/70 mt-0.5">{item.context}</span>
              )}
              {copiedIndex === index && (
                <span className="text-[10px] text-success mt-0.5 font-medium">{BLOCK_LABELS.copied}</span>
              )}
            </Button>
            {index < block.items.length - 1 && (
              <div className="fade-divider-vertical h-12" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
    </BlockWrapper>
  );
});
