import { memo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BlockWrapper } from './BlockWrapper';
import type { ComparisonBlock } from '@vie/types';
import { Check, X, ThumbsUp, ThumbsDown, Sparkles, Columns2, Rows3, type LucideIcon } from 'lucide-react';

interface ComparisonCardProps {
  block: ComparisonBlock;
}

// Static style configuration (no labels - those depend on block data)
interface VariantStyles {
  leftIcon: LucideIcon | null;
  rightIcon: LucideIcon | null;
  leftHeaderClass: string;
  rightHeaderClass: string;
  leftLabelClass: string;
  rightLabelClass: string;
  leftBulletClass: string;
  rightBulletClass: string;
}

// Full config including computed labels
interface VariantConfig extends VariantStyles {
  leftLabel: string;
  rightLabel: string;
}

type VariantKey = 'dos_donts' | 'pros_cons' | 'versus' | 'before_after';
type ViewMode = 'side-by-side' | 'stacked';

// Static styles - defined outside component to avoid recreation
const VARIANT_STYLES: Record<VariantKey, VariantStyles> = {
  dos_donts: {
    leftIcon: Check,
    rightIcon: X,
    leftHeaderClass: 'border-b border-success/20',
    rightHeaderClass: 'border-b border-destructive/20',
    leftLabelClass: 'text-success',
    rightLabelClass: 'text-destructive',
    leftBulletClass: 'bg-success/70',
    rightBulletClass: 'bg-destructive/70',
  },
  pros_cons: {
    leftIcon: ThumbsUp,
    rightIcon: ThumbsDown,
    leftHeaderClass: 'border-b border-info/20',
    rightHeaderClass: 'border-b border-warning/20',
    leftLabelClass: 'text-info',
    rightLabelClass: 'text-warning',
    leftBulletClass: 'bg-info/70',
    rightBulletClass: 'bg-warning/70',
  },
  versus: {
    leftIcon: null,
    rightIcon: null,
    leftHeaderClass: 'border-b border-border/50',
    rightHeaderClass: 'border-b border-border/50',
    leftLabelClass: 'text-muted-foreground',
    rightLabelClass: 'text-muted-foreground',
    leftBulletClass: 'bg-muted-foreground/50',
    rightBulletClass: 'bg-muted-foreground/50',
  },
  before_after: {
    leftIcon: null,
    rightIcon: Sparkles,
    leftHeaderClass: 'border-b border-muted-foreground/20',
    rightHeaderClass: 'border-b border-primary/20',
    leftLabelClass: 'text-muted-foreground',
    rightLabelClass: 'text-primary',
    leftBulletClass: 'bg-muted-foreground/70',
    rightBulletClass: 'bg-primary/70',
  },
};

// Default labels by variant - defined outside component
const DEFAULT_LABELS: Record<VariantKey, { left: string; right: string }> = {
  dos_donts: { left: 'Do', right: "Don't" },
  pros_cons: { left: 'Pros', right: 'Cons' },
  versus: { left: 'Option A', right: 'Option B' },
  before_after: { left: 'Before', right: 'After' },
};

/**
 * Renders a side-by-side comparison with variant-specific styling.
 * Row-aligned grid with fade dividers. Toggle between side-by-side and stacked layouts.
 * Variants: dos_donts (green/red), pros_cons (blue/orange), versus (neutral), before_after (timeline)
 */
export const ComparisonCard = memo(function ComparisonCard({ block }: ComparisonCardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');
  const variant = block.variant || 'versus';
  const variantKey: VariantKey = variant in VARIANT_STYLES
    ? (variant as VariantKey)
    : 'versus';

  // Get static styles (no recreation needed)
  const staticStyles = VARIANT_STYLES[variantKey];
  const defaultLabels = DEFAULT_LABELS[variantKey];

  // Build full config with computed labels
  const config: VariantConfig = {
    ...staticStyles,
    leftLabel: block.left.label || defaultLabels.left,
    rightLabel: block.right.label || defaultLabels.right,
  };
  const LeftIcon = config.leftIcon;
  const RightIcon = config.rightIcon;

  const isSideBySide = viewMode === 'side-by-side';
  const leftItems = block.left.items ?? [];
  const rightItems = block.right.items ?? [];
  const maxRows = Math.max(leftItems.length, rightItems.length);

  return (
    <BlockWrapper variant="transparent">
    <div className="overflow-hidden">
      {/* Header row with labels and toggle */}
      <div className={cn(
        'text-center relative',
        isSideBySide ? 'grid grid-cols-2' : 'flex flex-col'
      )}>
        {/* Toggle button */}
        <div className="absolute right-0 top-0 z-10">
          <Button
            variant="ghost"
            size="icon-bare"
            onClick={() => setViewMode(isSideBySide ? 'stacked' : 'side-by-side')}
            className="text-xs px-1.5 py-1 text-muted-foreground hover:bg-muted/20"
            aria-label={isSideBySide ? 'Switch to stacked view' : 'Switch to side-by-side view'}
          >
            {isSideBySide ? (
              <Rows3 className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Columns2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </Button>
        </div>

        <div className={cn('px-4 py-2', config.leftHeaderClass)}>
          <div className="flex items-center justify-center gap-1.5">
            {LeftIcon && <LeftIcon className={cn('h-3.5 w-3.5', config.leftLabelClass)} aria-hidden="true" />}
            <span className={cn('text-xs font-bold uppercase tracking-wider', config.leftLabelClass)}>
              {config.leftLabel}
            </span>
          </div>
        </div>
        {isSideBySide && (
          <div className={cn('px-4 py-2', config.rightHeaderClass)}>
            <div className="flex items-center justify-center gap-1.5">
              {RightIcon && <RightIcon className={cn('h-3.5 w-3.5', config.rightLabelClass)} aria-hidden="true" />}
              <span className={cn('text-xs font-bold uppercase tracking-wider', config.rightLabelClass)}>
                {config.rightLabel}
              </span>
            </div>
          </div>
        )}
      </div>

      {isSideBySide ? (
        /* Row-aligned grid */
        <div className="relative">
          {/* Vertical center divider */}
          <div className="fade-divider-vertical absolute left-1/2 top-2 bottom-2 -translate-x-px" aria-hidden="true" />
          {Array.from({ length: maxRows }).map((_, rowIndex) => {
            const leftItem = leftItems[rowIndex];
            const rightItem = rightItems[rowIndex];
            return (
              <div key={rowIndex}>
                {rowIndex > 0 && <div className="fade-divider" aria-hidden="true" />}
                <div className="grid grid-cols-2">
                  <div className={cn('p-2 px-4', variantKey === 'dos_donts' && 'bg-success/[0.04]', variantKey === 'pros_cons' && 'bg-info/[0.04]')}>
                    {leftItem ? (
                      <div className="flex items-baseline gap-2.5 text-sm py-1">
                        <span className={cn('w-1 h-1 rounded-full shrink-0 translate-y-1.5', config.leftBulletClass)} />
                        <span className="text-muted-foreground">{leftItem}</span>
                      </div>
                    ) : (
                      <div className="py-1 min-h-[1.75rem]" />
                    )}
                  </div>
                  <div className={cn('p-2 px-4', variantKey === 'dos_donts' && 'bg-destructive/[0.04]', variantKey === 'pros_cons' && 'bg-warning/[0.04]')}>
                    {rightItem ? (
                      <div className="flex items-baseline gap-2.5 text-sm py-1">
                        <span className={cn('w-1 h-1 rounded-full shrink-0 translate-y-1.5', config.rightBulletClass)} />
                        <span className="text-muted-foreground">{rightItem}</span>
                      </div>
                    ) : (
                      <div className="py-1 min-h-[1.75rem]" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Stacked layout */
        <div className="flex flex-col">
          {/* Left column */}
          <div className={cn("p-4", variantKey === 'dos_donts' && 'bg-success/[0.04] rounded-lg', variantKey === 'pros_cons' && 'bg-info/[0.04] rounded-lg')}>
            <ul className="space-y-0 stagger-children">
              {leftItems.map((item, index) => (
                <li key={index}>
                  <div className="flex items-baseline gap-2.5 text-sm py-1.5">
                    <span className={cn('w-1 h-1 rounded-full shrink-0 translate-y-1.5', config.leftBulletClass)} />
                    <span className="text-muted-foreground">{item}</span>
                  </div>
                  {index < leftItems.length - 1 && (
                    <div className="fade-divider" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Right column header (stacked mode) */}
          <div className={cn('px-4 py-2 text-center', config.rightHeaderClass)}>
            <div className="flex items-center justify-center gap-1.5">
              {RightIcon && <RightIcon className={cn('h-3.5 w-3.5', config.rightLabelClass)} aria-hidden="true" />}
              <span className={cn('text-xs font-bold uppercase tracking-wider', config.rightLabelClass)}>
                {config.rightLabel}
              </span>
            </div>
          </div>

          {/* Right column */}
          <div className={cn("p-4 pt-2", variantKey === 'dos_donts' && 'bg-destructive/[0.04] rounded-lg', variantKey === 'pros_cons' && 'bg-warning/[0.04] rounded-lg')}>
            <ul className="space-y-0 stagger-children">
              {rightItems.map((item, index) => (
                <li key={index}>
                  <div className="flex items-baseline gap-2.5 text-sm py-1.5">
                    <span className={cn('w-1 h-1 rounded-full shrink-0 translate-y-1.5', config.rightBulletClass)} />
                    <span className="text-muted-foreground">{item}</span>
                  </div>
                  {index < rightItems.length - 1 && (
                    <div className="fade-divider" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
    </BlockWrapper>
  );
});
