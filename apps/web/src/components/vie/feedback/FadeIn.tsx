import { memo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FadeInProps {
  children: ReactNode;
  /** Stagger delay index (each adds 75ms) */
  index?: number;
  className?: string;
}

/**
 * Entrance animation wrapper.
 * Replaces BlockWrapper's animate + index stagger props.
 */
export const FadeIn = memo(function FadeIn({
  children,
  index,
  className,
}: FadeInProps) {
  return (
    <div
      className={cn('block-entrance', className)}
      style={index !== undefined ? { animationDelay: `${index * 75}ms` } : undefined}
    >
      {children}
    </div>
  );
});
