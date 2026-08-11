import { memo, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const textBlockVariants = cva('flex items-start gap-1.5 animate-fade-up', {
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

export const TextBlock = memo(function TextBlock({
  intent,
  icon,
  children,
  className,
}: TextBlockProps) {
  return (
    <div className={cn(textBlockVariants({ intent }), className)}>
      {icon && (
        <span
          className={cn(
            'mt-0.5 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0 inline-flex animate-pop-in',
            intent ? ACCENT_TEXT[intent] : 'text-muted-foreground',
          )}
          style={{ animationDelay: '80ms' }}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
});
