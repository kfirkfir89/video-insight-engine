import { memo, useState } from 'react';
import { LayoutList, Check, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockWrapper } from './BlockWrapper';
import { ConceptHighlighter } from '../ConceptHighlighter';
import type { ToolListBlock as ToolListBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface ToolListBlockProps {
  block: ToolListBlockType;
}

/**
 * Renders an equipment/tool list with optional checkbox tracking.
 */
export const ToolListBlock = memo(function ToolListBlock({ block }: ToolListBlockProps) {
  const tools = block.tools ?? [];
  const [checkedTools, setCheckedTools] = useState<Set<number>>(new Set());

  if (tools.length === 0) return null;

  const toggleTool = (index: number) => {
    setCheckedTools(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <BlockWrapper
      blockId={block.blockId}
      label={BLOCK_LABELS.tools}
      variant="inline"
    >
      <div className="space-y-2">
        <div className="block-label-minimal">
          <LayoutList className="h-3 w-3" aria-hidden="true" />
          <span>{BLOCK_LABELS.tools}</span>
        </div>
        <ul className="grid gap-0 sm:grid-cols-2" role="list">
          {tools.map((tool, index) => {
            const isChecked = checkedTools.has(index) || tool.checked;
            return (
              <li
                key={index}
                className={cn(
                  'flex items-start gap-2.5 text-sm py-2 transition-colors',
                  isChecked && 'opacity-60'
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleTool(index)}
                  className={cn(
                    'shrink-0 mt-0.5 transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded'
                  )}
                  aria-label={isChecked ? `Uncheck ${tool.name}` : `Check ${tool.name}`}
                >
                  {isChecked ? (
                    <Check className="h-4 w-4 text-success dark:drop-shadow-[0_0_4px_currentColor]" aria-hidden="true" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
                  )}
                </button>
                <div className={cn('flex-1', isChecked && 'line-through text-muted-foreground/50')}>
                  <span className="font-medium">{tool.name}</span>
                  {tool.quantity && (
                    <span className="text-muted-foreground"> — {tool.quantity}</span>
                  )}
                  {tool.notes && (
                    <span className="text-xs text-muted-foreground/70 ml-1">(<ConceptHighlighter text={tool.notes} />)</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </BlockWrapper>
  );
});
