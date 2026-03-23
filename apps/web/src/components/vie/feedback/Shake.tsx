import { memo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ShakeProps {
  active: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Horizontal shake animation wrapper.
 * Used for wrong answers, validation errors, etc.
 */
export const Shake = memo(function Shake({
  active,
  children,
  className,
}: ShakeProps) {
  return (
    <div
      className={cn(
        active && 'animate-[shake_0.4s_ease-in-out]',
        className,
      )}
    >
      {children}
    </div>
  );
});
