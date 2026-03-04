import { type ComponentProps, forwardRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Elevated glass surface with real backdrop blur.
 * Max 3-4 per screen. Only for: sticky nav, hero cards, active card, modal overlays.
 */
const GlassElevated = forwardRef<HTMLDivElement, ComponentProps<'div'>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('glass-elevated rounded-xl', className)}
      {...props}
    />
  ),
);
GlassElevated.displayName = 'GlassElevated';

export { GlassElevated };
