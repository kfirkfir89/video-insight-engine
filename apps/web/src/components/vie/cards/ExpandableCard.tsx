import { memo, useState, useCallback, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface ExpandableCardProps {
  header: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}

/**
 * Card with collapsible content section.
 * Click header to expand/collapse the body.
 */
export const ExpandableCard = memo(function ExpandableCard({
  header,
  children,
  defaultExpanded = false,
  className,
}: ExpandableCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggle = useCallback(() => setExpanded((p) => !p), []);

  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur,20px)] overflow-hidden',
        className,
      )}
    >
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-muted/10 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">{header}</div>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            expanded && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>
      {expanded && (
        <div className="px-4 pb-4 animate-[fadeUp_0.2s_ease_both]">
          {children}
        </div>
      )}
    </div>
  );
});
