import { memo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const textBlockVariants = cva('flex items-start gap-1.5', {
  variants: {
    intent: {
      tip: 'callout-gradient-tip',
      warning: 'callout-gradient-warning',
      note: 'callout-gradient-note',
      security: 'callout-gradient-security',
    },
  },
});

const ACCENT_TEXT: Record<string, string> = {
  tip: 'text-warning',
  warning: 'text-destructive',
  note: 'text-info',
  security: 'text-destructive',
};

type TextBlockProps = VariantProps<typeof textBlockVariants> & {
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Accent-bordered text block (replaces CalloutBlock).
 * Domain-free: pass icon and intent, no style config objects.
 */
export const TextBlock = memo(function TextBlock({
  intent,
  icon,
  children,
  className,
}: TextBlockProps) {
  return (
    <div
      className={cn(
        textBlockVariants({ intent }),
        className,
      )}
    >
      {icon && (
        <span className={cn('mt-0.5 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0', intent ? ACCENT_TEXT[intent] : 'text-muted-foreground')} aria-hidden="true">
          {icon}
        </span>
      )}
      <p className="text-xs text-muted-foreground">{children}</p>
    </div>
  );
});
