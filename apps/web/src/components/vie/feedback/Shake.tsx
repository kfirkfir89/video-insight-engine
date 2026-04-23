import { memo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ShakeProps {
  active: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Horizontal shake wrapper — used for wrong answers, validation errors.
 * Keyed by `active` so the CSS keyframe restarts on each wrong answer.
 */
export const Shake = memo(function Shake({ active, children, className }: ShakeProps) {
  return (
    <div
      key={active ? 'shake-on' : 'shake-off'}
      className={cn(active && 'animate-[shake_0.5s_cubic-bezier(0.25,1,0.5,1)_both]', className)}
    >
      {children}
    </div>
  );
});
