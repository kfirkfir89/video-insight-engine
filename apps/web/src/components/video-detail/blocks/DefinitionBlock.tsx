import { memo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { BlockWrapper } from './BlockWrapper';
import { ConceptHighlighter } from '../ConceptHighlighter';
import type { DefinitionBlock as DefinitionBlockType } from '@vie/types';

interface DefinitionBlockProps {
  block: DefinitionBlockType;
}

/**
 * Renders a term with its definition.
 * Supports accordion behavior for long definitions.
 */
export const DefinitionBlock = memo(function DefinitionBlock({ block }: DefinitionBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const isLongDefinition = block.meaning && block.meaning.length > 200;

  if (!block.term) return null;

  return (
    <BlockWrapper
      blockId={block.blockId}
      variant="accent"
      accentColor="primary"
      label={`Definition of ${block.term}`}
    >
      <dl className="definition-item hover:bg-muted/10 rounded-sm transition-colors">
        <dt className="text-sm font-semibold hover:text-primary transition-colors">
          <ConceptHighlighter text={block.term} />
        </dt>
        <dd className="mt-1">
          {isLongDefinition && !expanded ? (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground line-clamp-3">
                <ConceptHighlighter text={block.meaning} />
              </p>
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="flex items-center gap-0.5 text-xs text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
              >
                <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Show more</span>
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground"><ConceptHighlighter text={block.meaning} /></p>
              {isLongDefinition && (
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="flex items-center gap-0.5 text-xs text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
                >
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 rotate-90" aria-hidden="true" />
                  <span>Show less</span>
                </button>
              )}
            </div>
          )}
        </dd>
      </dl>
    </BlockWrapper>
  );
});
