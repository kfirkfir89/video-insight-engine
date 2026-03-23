import { memo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DefinitionItemProps {
  term: string;
  meaning: string;
  className?: string;
}

/**
 * Domain-free term + definition display.
 * Long definitions are truncated with expand/collapse.
 */
export const DefinitionItem = memo(function DefinitionItem({
  term,
  meaning,
  className,
}: DefinitionItemProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = meaning.length > 200;

  return (
    <dl className={cn('hover:bg-muted/10 rounded-sm transition-colors', className)}>
      <dt className="text-sm font-semibold text-primary">{term}</dt>
      <dd className="mt-1">
        {isLong && !expanded ? (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground line-clamp-3">{meaning}</p>
            <Button
              variant="ghost"
              size="bare"
              onClick={() => setExpanded(true)}
              className="text-xs text-primary hover:underline"
            >
              <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Show more</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{meaning}</p>
            {isLong && (
              <Button
                variant="ghost"
                size="bare"
                onClick={() => setExpanded(false)}
                className="text-xs text-primary hover:underline"
              >
                <ChevronRight className="h-3.5 w-3.5 shrink-0 rotate-90" aria-hidden="true" />
                <span>Show less</span>
              </Button>
            )}
          </div>
        )}
      </dd>
    </dl>
  );
});
