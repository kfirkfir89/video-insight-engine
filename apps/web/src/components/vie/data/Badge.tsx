import { memo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { detectBadgeVariant } from './badge-colors';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary',
        success: 'bg-success/10 text-success',
        warning: 'bg-warning/10 text-warning',
        destructive: 'bg-destructive/10 text-destructive',
        info: 'bg-info/10 text-info',
        muted: 'bg-muted/50 text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

type BadgeProps = VariantProps<typeof badgeVariants> & {
  children: ReactNode;
  className?: string;
  /** When true, auto-detect variant from children text content. Ignored if variant is explicitly set. */
  autoColor?: boolean;
};

export const Badge = memo(function Badge({ variant, children, className, autoColor }: BadgeProps) {
  const resolvedVariant = autoColor && !variant
    ? detectBadgeVariant(typeof children === 'string' ? children : '')
    : variant;

  return (
    <span className={cn(badgeVariants({ variant: resolvedVariant }), className)}>
      {children}
    </span>
  );
});
