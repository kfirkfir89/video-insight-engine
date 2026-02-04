import { memo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { BlockWrapper } from './BlockWrapper';
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
      label={`Definition of ${block.term}`}
    >
      <div className="border-l-2 border-primary/30 pl-3">
        <dl>
          <dt className="text-sm font-medium">{block.term}</dt>
          <dd className="mt-0.5">
            {isLongDefinition && !expanded ? (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {block.meaning}
                </p>
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="flex items-center gap-0.5 text-xs text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
                >
                  <ChevronRight className="h-3 w-3" aria-hidden="true" />
                  <span>Show more</span>
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{block.meaning}</p>
                {isLongDefinition && (
                  <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    className="flex items-center gap-0.5 text-xs text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
                  >
                    <ChevronRight className="h-3 w-3 rotate-90" aria-hidden="true" />
                    <span>Show less</span>
                  </button>
                )}
              </div>
            )}
          </dd>
        </dl>
      </div>
    </BlockWrapper>
  );
});
