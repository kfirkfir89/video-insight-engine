import { memo, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Surface hierarchy (canonical card primitive):
 *   default     → opaque card (in-flow content; the workhorse)
 *   elevated    → opaque card with stronger shadow (raised attention)
 *   outlined    → border-only (lightweight grouping)
 *   interactive → opaque card with hover lift (clickable surfaces)
 *   accent      → translucent glass (reserved for ephemeral overlays / hero framing)
 *   subtle      → muted tint (background grouping)
 *
 * Glass blur is reserved for variant="accent" so floating chrome reads as
 * "above the page." Keeping default opaque restores the depth signal that
 * collapses when every surface is translucent.
 *
 * Radius is unified at rounded-2xl across the card system; override only
 * when a surface is compositionally nested inside another rounded container.
 */
const glassCardVariants = cva(
  'rounded-2xl p-5 transition-[transform,box-shadow] duration-200 ease-[var(--ease-out-expo)]',
  {
    variants: {
      variant: {
        default: 'bg-card border border-border shadow-[var(--glass-shadow)]',
        elevated:
          'bg-card border border-border shadow-[var(--glass-shadow-elevated,var(--glass-shadow))]',
        outlined: 'bg-transparent border border-border',
        interactive:
          'bg-card border border-border shadow-[var(--glass-shadow)] cursor-pointer hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 motion-reduce:hover:translate-y-0',
        accent:
          'bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur,20px)] border border-[var(--vie-accent-border,var(--glass-border))] shadow-[var(--glass-shadow)]',
        subtle: 'bg-muted/20 border border-transparent',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

type GlassCardProps = VariantProps<typeof glassCardVariants> & {
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
  onClick?: () => void;
};

export const GlassCard = memo(function GlassCard({
  variant = 'default',
  className,
  style,
  children,
  onClick,
}: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(glassCardVariants({ variant }), className)}
      style={style}
    >
      {children}
    </div>
  );
});
