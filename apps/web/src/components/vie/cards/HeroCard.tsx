import { memo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface HeroCardProps {
  emoji?: string;
  title: string;
  subtitle?: string;
  /** Optional gradient CSS for background */
  gradient?: string;
  children?: ReactNode;
  className?: string;
}

/**
 * Full-width hero card for section headers.
 * Used for overview tabs, verdict summaries, etc.
 */
export const HeroCard = memo(function HeroCard({
  emoji,
  title,
  subtitle,
  gradient,
  children,
  className,
}: HeroCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl p-6 text-center bg-[var(--glass-bg)] border border-[var(--glass-border)]',
        className,
      )}
      style={gradient ? { background: gradient } : undefined}
    >
      {emoji && <span className="text-4xl block mb-2" aria-hidden="true">{emoji}</span>}
      <h3 className="font-semibold text-lg tracking-tight leading-snug">{title}</h3>
      {subtitle && <p className="text-sm text-muted-foreground leading-relaxed mt-1.5">{subtitle}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
});
