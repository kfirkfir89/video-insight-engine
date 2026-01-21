import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { ComparisonBlock } from '@vie/types';
import { Check, X, ThumbsUp, ThumbsDown, Sparkles, type LucideIcon } from 'lucide-react';

interface ComparisonRendererProps {
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

// Static styles - defined outside component to avoid recreation
const VARIANT_STYLES: Record<VariantKey, VariantStyles> = {
  dos_donts: {
    leftIcon: Check,
    rightIcon: X,
    leftHeaderClass: 'border-b border-emerald-500/30',
    rightHeaderClass: 'border-b border-rose-500/30',
    leftLabelClass: 'text-emerald-600/80 dark:text-emerald-400/80',
    rightLabelClass: 'text-rose-600/80 dark:text-rose-400/80',
    leftBulletClass: 'bg-emerald-500/60',
    rightBulletClass: 'bg-rose-500/60',
  },
  pros_cons: {
    leftIcon: ThumbsUp,
    rightIcon: ThumbsDown,
    leftHeaderClass: 'border-b border-sky-500/30',
    rightHeaderClass: 'border-b border-orange-500/30',
    leftLabelClass: 'text-sky-600/80 dark:text-sky-400/80',
    rightLabelClass: 'text-orange-600/80 dark:text-orange-400/80',
    leftBulletClass: 'bg-sky-500/60',
    rightBulletClass: 'bg-orange-500/60',
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
    leftHeaderClass: 'border-b border-slate-400/30',
    rightHeaderClass: 'border-b border-violet-500/30',
    leftLabelClass: 'text-slate-500/80 dark:text-slate-400/80',
    rightLabelClass: 'text-violet-600/80 dark:text-violet-400/80',
    leftBulletClass: 'bg-slate-400/60',
    rightBulletClass: 'bg-violet-500/60',
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
 * Variants: dos_donts (green/red), pros_cons (blue/orange), versus (neutral), before_after (timeline)
 */
export const ComparisonRenderer = memo(function ComparisonRenderer({ block }: ComparisonRendererProps) {
  const variant = block.variant || 'versus';
  const variantKey = variant as VariantKey;

  // Get static styles (no recreation needed)
  const staticStyles = VARIANT_STYLES[variantKey] ?? VARIANT_STYLES.versus;
  const defaultLabels = DEFAULT_LABELS[variantKey] ?? DEFAULT_LABELS.versus;

  // Build full config with computed labels
  const config: VariantConfig = {
    ...staticStyles,
    leftLabel: block.left.label || defaultLabels.left,
    rightLabel: block.right.label || defaultLabels.right,
  };
  const LeftIcon = config.leftIcon;
  const RightIcon = config.rightIcon;

  return (
    <div className="rounded-lg border border-border/40 overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2">
        {/* Left column */}
        <div className="p-4 sm:border-r border-border/40">
          <div className={cn('flex items-center gap-1.5 pb-2 mb-3', config.leftHeaderClass)}>
            {LeftIcon && <LeftIcon className={cn('h-3.5 w-3.5', config.leftLabelClass)} aria-hidden="true" />}
            <span className={cn('text-xs font-medium', config.leftLabelClass)}>
              {config.leftLabel}
            </span>
          </div>
          <ul className="space-y-1.5">
            {block.left.items.map((item, index) => (
              <li key={index} className="flex items-baseline gap-2.5 text-sm">
                <span className={cn('w-1 h-1 rounded-full shrink-0 translate-y-1.5', config.leftBulletClass)} />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right column */}
        <div className="p-4 border-t sm:border-t-0 border-border/40">
          <div className={cn('flex items-center gap-1.5 pb-2 mb-3', config.rightHeaderClass)}>
            {RightIcon && <RightIcon className={cn('h-3.5 w-3.5', config.rightLabelClass)} aria-hidden="true" />}
            <span className={cn('text-xs font-medium', config.rightLabelClass)}>
              {config.rightLabel}
            </span>
          </div>
          <ul className="space-y-1.5">
            {block.right.items.map((item, index) => (
              <li key={index} className="flex items-baseline gap-2.5 text-sm">
                <span className={cn('w-1 h-1 rounded-full shrink-0 translate-y-1.5', config.rightBulletClass)} />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
});
