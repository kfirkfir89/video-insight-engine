import { memo } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { BlockWrapper } from './BlockWrapper';
import { ConceptHighlighter } from '../ConceptHighlighter';
import type { ProblemSolutionBlock as ProblemSolutionBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface ProblemSolutionBlockProps {
  block: ProblemSolutionBlockType;
}

/**
 * Renders a problem/solution card with two sections:
 * - Problem: red/orange accent with AlertCircle icon
 * - Solution: green accent with CheckCircle2 icon
 */
export const ProblemSolutionBlock = memo(function ProblemSolutionBlock({
  block,
}: ProblemSolutionBlockProps) {
  if (!block.problem && !block.solution) return null;

  return (
    <BlockWrapper
      blockId={block.blockId}
      variant="transparent"
      label={BLOCK_LABELS.problemSolution}
    >
      <div className="space-y-0 rounded-lg overflow-hidden">
        {/* Problem section */}
        {block.problem && (
          <div className="bg-destructive/[0.04] p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />
              <span className="text-xs font-medium text-destructive">{BLOCK_LABELS.problem}</span>
            </div>
            <p className="text-sm text-muted-foreground pl-5">
              <ConceptHighlighter text={block.problem} />
            </p>
          </div>
        )}

        {/* Divider */}
        {block.problem && block.solution && (
          <div className="fade-divider" aria-hidden="true" />
        )}

        {/* Solution section */}
        {block.solution && (
          <div className="bg-success/[0.04] p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
              <span className="text-xs font-medium text-success">{BLOCK_LABELS.solution}</span>
            </div>
            <p className="text-sm text-muted-foreground pl-5">
              <ConceptHighlighter text={block.solution} />
            </p>
          </div>
        )}

        {/* Optional context */}
        {block.context && (
          <>
            <div className="fade-divider" aria-hidden="true" />
            <div className="bg-muted/[0.03] px-4 py-3">
              <p className="text-xs text-muted-foreground/70">
                <ConceptHighlighter text={block.context} />
              </p>
            </div>
          </>
        )}
      </div>
    </BlockWrapper>
  );
});
