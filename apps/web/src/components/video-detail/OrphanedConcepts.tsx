import { useState, useCallback, memo } from 'react';
import { Lightbulb, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Concept } from '@vie/types';

interface OrphanedConceptsProps {
  concepts: Concept[];
}

/**
 * Renders concepts that couldn't be matched to any chapter.
 * Only visible when orphaned concepts exist. Collapsible.
 */
export const OrphanedConcepts = memo(function OrphanedConcepts({ concepts }: OrphanedConceptsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback(() => setIsExpanded((p) => !p), []);

  const toggleDefinition = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (concepts.length === 0) return null;

  return (
    <div className="pt-2 pb-4">
      <button
        type="button"
        onClick={toggleExpanded}
        className="flex items-center gap-2 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors w-full"
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
        )}
        <Lightbulb className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>Additional Concepts ({concepts.length})</span>
      </button>

      {isExpanded && (
        <ul className="mt-2 ml-5 space-y-1">
          {concepts.map((concept) => {
            const isDefExpanded = expandedIds.has(concept.id);
            const hasDefinition = !!concept.definition;

            return (
              <li key={concept.id}>
                <button
                  type="button"
                  onClick={() => hasDefinition && toggleDefinition(concept.id)}
                  className={cn(
                    'flex items-start gap-1 text-xs text-muted-foreground/80 leading-tight text-left w-full rounded-sm',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1',
                    hasDefinition && 'hover:text-muted-foreground cursor-pointer',
                  )}
                  disabled={!hasDefinition}
                  aria-expanded={hasDefinition ? isDefExpanded : undefined}
                >
                  {hasDefinition && (
                    <ChevronRight
                      className={cn(
                        'h-3 w-3 shrink-0 mt-0.5 transition-transform duration-200',
                        isDefExpanded && 'rotate-90',
                      )}
                      aria-hidden="true"
                    />
                  )}
                  <span className={!hasDefinition ? 'ml-4' : ''}>
                    {concept.name}
                  </span>
                </button>
                {hasDefinition && isDefExpanded && (
                  <p className="text-xs text-muted-foreground/60 leading-relaxed ml-4 pt-0.5 pb-1">
                    {concept.definition}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});
