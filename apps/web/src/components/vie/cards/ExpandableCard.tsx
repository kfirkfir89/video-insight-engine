import { memo, useState, useCallback, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExpandableCardProps {
  header: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}

export const ExpandableCard = memo(function ExpandableCard({
  header,
  children,
  defaultExpanded = false,
  className,
}: ExpandableCardProps) {
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);
  const toggle = useCallback(() => setExpanded((p) => !p), []);

  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card overflow-hidden',
        className,
      )}
    >
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between gap-2 p-5 text-start hover:bg-muted/10 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">{header}</div>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-[var(--ease-out-expo)]',
            expanded && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>
      <div
        className="grid transition-[grid-template-rows,opacity] duration-300 ease-[var(--ease-out-expo)]"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr', opacity: expanded ? 1 : 0 }}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5">{children}</div>
        </div>
      </div>
    </div>
  );
});
