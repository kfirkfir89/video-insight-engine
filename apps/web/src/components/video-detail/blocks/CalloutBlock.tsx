import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { CalloutStyle } from '@vie/types';

interface CalloutBlockProps {
  style: CalloutStyle;
  variant?: string;
  text: string;
}

/**
 * Renders a callout block with colored border based on style.
 * Variants:
 * - chef_tip: Warm amber styling for cooking tips
 */
export const CalloutBlock = memo(function CalloutBlock({ style, variant, text }: CalloutBlockProps) {
  const isChefTip = variant === 'chef_tip';

  // Simple border color mapping - no icons or labels, just colored border
  const borderClasses: Record<CalloutStyle, string> = {
    tip: isChefTip ? 'border-orange-400/60' : 'border-amber-400/60',
    warning: 'border-rose-400/60',
    note: 'border-sky-400/60',
    chef_tip: 'border-orange-400/60',
    security: 'border-rose-500/60',
  };

  const borderClass = borderClasses[style] || borderClasses.note;

  return (
    <div className={cn('py-2 pl-3 border-l-2 text-sm text-muted-foreground', borderClass)}>
      {text}
    </div>
  );
});
