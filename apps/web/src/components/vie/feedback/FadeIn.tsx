import { memo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FadeInProps {
  children: ReactNode;
  /** Stagger index — each step adds 60ms */
  index?: number;
  className?: string;
}

/**
 * Entrance wrapper. Pure CSS `animate-fade-up` with inline animation-delay for stagger.
 * No motion runtime; motion-reduce fallback handled by the global prefers-reduced-motion rule.
 */
export const FadeIn = memo(function FadeIn({
  children,
  index,
  className,
}: FadeInProps) {
  // Check `!== undefined` (not truthy) — an index of 0 should still render
  // without stagger, not silently omit the delay style the caller expects.
  const animationDelay = index !== undefined ? `${index * 60}ms` : undefined;
  return (
    <div
      className={cn('animate-fade-up', className)}
      style={animationDelay ? { animationDelay } : undefined}
    >
      {children}
    </div>
  );
});
