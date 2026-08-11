import { memo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface DefinitionItemProps {
  term: string;
  meaning: string;
  className?: string;
}

/**
 * Term + definition. Long meanings toggle between clamped and full view via
 * a single `<p>` with a class-gated `line-clamp`. No motion runtime.
 */
export const DefinitionItem = memo(function DefinitionItem({
  term,
  meaning,
  className,
}: DefinitionItemProps) {
  const [expanded, setExpanded] = useState<boolean>(false);
  const isLong = meaning.length > 200;

  return (
    <dl className={cn('hover:bg-muted/10 rounded-md transition-colors', className)}>
      <dt className="text-sm font-semibold tracking-tight text-primary">{term}</dt>
      <dd className="mt-1.5 space-y-1.5">
        <p
          className={cn(
            'text-sm text-muted-foreground leading-relaxed text-pretty',
            isLong && !expanded && 'line-clamp-3',
          )}
        >
          {meaning}
        </p>
        {isLong && (
          <Button
            variant="ghost"
            size="bare"
            onClick={() => setExpanded((p) => !p)}
            className="text-xs text-primary hover:underline"
          >
            <ChevronRight
              className={cn(
                'h-3.5 w-3.5 shrink-0 rtl:rotate-180 transition-transform duration-200 ease-[var(--ease-out-expo)]',
                expanded && 'rotate-90',
              )}
              aria-hidden="true"
            />
            <span>{expanded ? 'Show less' : 'Show more'}</span>
          </Button>
        )}
      </dd>
    </dl>
  );
});
