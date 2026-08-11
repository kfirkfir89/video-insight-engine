import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { ParticleBurst } from '../effects/ParticleBurst';

interface CelebrationProps {
  emoji: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** Disable confetti burst (e.g. for reduced-intensity contexts). */
  muted?: boolean;
  className?: string;
}

/**
 * Celebration card with canvas particle burst + CSS-choreographed reveal.
 * Motion dep dropped — staggered reveal uses animation-delay.
 */
export const Celebration = memo(function Celebration({
  emoji,
  title,
  subtitle,
  action,
  muted = false,
  className,
}: CelebrationProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [burstKey, setBurstKey] = useState<number>(0);
  const firedRef = useRef<boolean>(false);

  // Reset the fire guard when the celebration's identity changes so a parent
  // reusing the same instance for sequential wins still gets a fresh burst.
  useEffect(() => {
    firedRef.current = false;
  }, [emoji, title, subtitle]);

  useEffect(() => {
    if (firedRef.current || muted || reducedMotion) return;
    firedRef.current = true;
    const id = requestAnimationFrame(() => setBurstKey((k) => k + 1));
    return () => cancelAnimationFrame(id);
  }, [muted, reducedMotion, emoji, title, subtitle]);

  // Gate the staged reveal on reducedMotion — under the OS preference the
  // content should appear in place, not cascade in. `muted` keeps the card
  // calm but still lets the stagger run (it's an intensity knob, not a
  // motion-sensitivity knob).
  const animate = !reducedMotion;
  const delay = (ms: number): React.CSSProperties | undefined =>
    animate ? { animationDelay: `${ms}ms` } : undefined;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl p-6 text-center',
        animate && 'animate-pop-in',
        'bg-[oklch(from_var(--success)_l_c_h_/_0.08)] border border-success/30',
        'shadow-[0_12px_48px_-12px_oklch(from_var(--success)_l_c_h_/_0.3)]',
        className,
      )}
      role="alert"
    >
      {!muted && <ParticleBurst trigger={burstKey} disabled={reducedMotion} originY={55} />}

      <span
        className={cn('text-5xl block mb-3 leading-none', animate && 'animate-pop-in')}
        style={delay(100)}
        aria-hidden="true"
      >
        {emoji}
      </span>

      <h3
        className={cn(
          'font-semibold text-xl tracking-tight leading-snug text-balance',
          animate && 'animate-fade-up',
        )}
        style={delay(220)}
      >
        {title}
      </h3>
      {subtitle && (
        <p
          className={cn(
            'text-sm leading-relaxed text-muted-foreground mt-2 max-w-prose mx-auto text-pretty',
            animate && 'animate-fade-up',
          )}
          style={delay(300)}
        >
          {subtitle}
        </p>
      )}
      {action && (
        <div
          className={cn('mt-5 relative z-10', animate && 'animate-fade-up')}
          style={delay(400)}
        >
          {action}
        </div>
      )}
    </div>
  );
});

export const CelebrationNextButton = memo(function CelebrationNextButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="gap-1.5 text-xs font-medium text-[var(--vie-accent)] group hover:translate-x-0.5 transition-transform duration-150"
    >
      {label}
      <ChevronRight
        className="h-3.5 w-3.5 rtl:rotate-180 transition-transform duration-200 group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Button>
  );
});
