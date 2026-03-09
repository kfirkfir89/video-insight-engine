import { type ReactNode } from 'react';
import { cn } from '../../../lib/utils';

type GlassCardVariant = 'default' | 'elevated' | 'outlined' | 'interactive';

interface GlassCardProps {
  variant?: GlassCardVariant;
  className?: string;
  children: ReactNode;
}

const variantStyles: Record<GlassCardVariant, string> = {
  default: 'bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-[var(--glass-shadow)]',
  elevated: 'bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-lg shadow-[var(--glass-shadow)]',
  outlined: 'bg-transparent border-2 border-[var(--glass-border)]',
  interactive: 'bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-[var(--glass-shadow)] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200',
};

export function GlassCard({ variant = 'default', className, children }: GlassCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl p-5 backdrop-blur-[var(--glass-blur,20px)]',
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
