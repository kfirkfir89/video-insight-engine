import { memo, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { usePointerGlow } from '@/hooks/use-pointer-glow';

/**
 * HeroCard — in-page hero tile for domain outputs.
 *
 * Variants:
 *   default   → emoji renders as a small leading glyph beside the title.
 *               Quiet entrance (fade-up only). The workhorse for
 *               Verdict / Budget / Exercise / Overview heroes in-app.
 *   marketing → emoji renders as a large centered glyph above the title
 *               with a staggered pop-in. Reserved for Landing / marketing
 *               surfaces where a hero "poster" silhouette is intentional.
 *
 * The marketing variant is deliberately gated because the centered-big-emoji
 * tile is a visual AI-trope when repeated inside the app. Keeping it
 * opt-in preserves the pattern for moments it actually earns its weight.
 */
const heroCardVariants = cva(
  'vie-pointer-glow vie-pointer-glow--strong relative rounded-2xl overflow-hidden animate-fade-up bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur,20px)] border border-[var(--vie-accent-border,var(--glass-border))] shadow-[var(--glass-shadow)]',
  {
    variants: {
      variant: {
        default: 'p-5 text-left',
        marketing: 'p-6 text-center vie-pointer-glow--strong',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

interface HeroCardProps extends VariantProps<typeof heroCardVariants> {
  emoji?: string;
  title: string;
  subtitle?: string;
  gradient?: string;
  children?: ReactNode;
  className?: string;
}

export const HeroCard = memo(function HeroCard({
  variant,
  emoji,
  title,
  subtitle,
  gradient,
  children,
  className,
}: HeroCardProps) {
  const pointer = usePointerGlow();
  const isMarketing = variant === 'marketing';

  return (
    <div
      ref={pointer.ref}
      onPointerMove={pointer.onPointerMove}
      onPointerEnter={pointer.onPointerEnter}
      onPointerLeave={pointer.onPointerLeave}
      className={cn(heroCardVariants({ variant }), className)}
      style={gradient ? { background: gradient } : undefined}
    >
      {isMarketing ? (
        <>
          {emoji && (
            <span
              className="text-4xl block mb-2 animate-pop-in"
              style={{ animationDelay: '80ms' }}
              aria-hidden="true"
            >
              {emoji}
            </span>
          )}
          <h3 className="font-semibold text-lg tracking-tight leading-snug text-balance">{title}</h3>
          {subtitle && (
            <p className="text-sm text-muted-foreground leading-relaxed mt-1.5 max-w-prose mx-auto text-pretty">
              {subtitle}
            </p>
          )}
          {children && <div className="mt-3 relative z-10">{children}</div>}
        </>
      ) : (
        <>
          <div className="flex items-baseline gap-2.5">
            {emoji && (
              <span className="text-xl leading-none shrink-0" aria-hidden="true">
                {emoji}
              </span>
            )}
            <h3 className="font-semibold text-lg tracking-tight leading-snug text-balance">{title}</h3>
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground leading-relaxed mt-1.5 text-pretty">
              {subtitle}
            </p>
          )}
          {children && <div className="mt-3 relative z-10">{children}</div>}
        </>
      )}
    </div>
  );
});
