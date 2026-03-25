import { memo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FadeInProps {
  children: ReactNode;
  /** Stagger delay index (each adds 75ms) */
  index?: number;
  className?: string;
}

/**
 * Entrance animation wrapper with stagger support.
 * Uses .entrance-fade class with prefers-reduced-motion fallback.
 */
export const FadeIn = memo(function FadeIn({
  children,
  index,
  className,
}: FadeInProps) {
  return (
    <div
      className={cn('entrance-fade', className)}
      style={index !== undefined ? { animationDelay: `${index * 75}ms` } : undefined}
    >
      {children}
    </div>
  );
});
