import { memo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const glassCardVariants = cva(
  'rounded-2xl p-5 backdrop-blur-[var(--glass-blur,20px)]',
  {
    variants: {
      variant: {
        default: 'bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-[var(--glass-shadow)]',
        elevated: 'bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-lg shadow-[var(--glass-shadow)]',
        outlined: 'bg-transparent border-2 border-[var(--glass-border)]',
        interactive: 'bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-[var(--glass-shadow)] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200',
        accent: 'bg-[var(--glass-bg)] border border-[var(--vie-accent-border,var(--glass-border))] shadow-[var(--glass-shadow)]',
        subtle: 'bg-muted/20 border border-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

type GlassCardProps = VariantProps<typeof glassCardVariants> & {
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
};

export const GlassCard = memo(function GlassCard({ variant, className, style, children }: GlassCardProps) {
  return (
    <div className={cn(glassCardVariants({ variant }), className)} style={style}>
      {children}
    </div>
  );
});
