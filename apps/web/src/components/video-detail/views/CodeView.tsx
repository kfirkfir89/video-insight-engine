import { memo, useMemo } from 'react';
import { Code2, GitCompare } from 'lucide-react';
import type { SummaryChapter, ContentBlock } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';

interface CodeViewProps {
  chapter: SummaryChapter;
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isVideoActive?: boolean;
  activeStartSeconds?: number;
}

/**
 * Specialized view for code/programming content.
 * Emphasizes:
 * - Code examples and terminal commands
 * - Comparisons (dos/donts, before/after)
 * - Technical concepts
 */
export const CodeView = memo(function CodeView({
  chapter,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
}: CodeViewProps) {
  // Group blocks by type for code-optimized layout
  const { codeBlocks, comparisonBlocks, otherBlocks } = useMemo(() => {
    const code: ContentBlock[] = [];
    const comparisons: ContentBlock[] = [];
    const other: ContentBlock[] = [];

    for (const block of chapter.content ?? []) {
      if (block.type === 'example' || (block.type === 'bullets' && block.variant === 'terminal_command')) {
        code.push(block);
      } else if (block.type === 'comparison') {
        comparisons.push(block);
      } else {
        other.push(block);
      }
    }

    return { codeBlocks: code, comparisonBlocks: comparisons, otherBlocks: other };
  }, [chapter.content]);

  const hasCodeBlocks = codeBlocks.length > 0;
  const hasComparisons = comparisonBlocks.length > 0;
  const hasOtherBlocks = otherBlocks.length > 0;

  // Early return for empty content to avoid rendering empty wrapper
  if (!hasCodeBlocks && !hasComparisons && !hasOtherBlocks) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Main content */}
      {hasOtherBlocks && (
        <ContentBlocks
          blocks={otherBlocks}
          onPlay={onPlay}
          onStop={onStop}
          isVideoActive={isVideoActive}
          activeStartSeconds={activeStartSeconds}
        />
      )}

      {/* Code Examples Section */}
      {hasCodeBlocks && (
        <div className="mt-4">
          <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
            <Code2 className="h-4 w-4" aria-hidden="true" />
            <span>Code Examples</span>
          </h4>
          <div className="space-y-3 pl-1">
            <ContentBlocks
              blocks={codeBlocks}
              onPlay={onPlay}
              onStop={onStop}
              isVideoActive={isVideoActive}
              activeStartSeconds={activeStartSeconds}
            />
          </div>
        </div>
      )}

      {/* Comparisons Section (dos/donts, before/after) */}
      {hasComparisons && (
        <div className="mt-4">
          <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
            <GitCompare className="h-4 w-4" aria-hidden="true" />
            <span>Comparisons</span>
          </h4>
          <div className="space-y-3 pl-1">
            <ContentBlocks
              blocks={comparisonBlocks}
              onPlay={onPlay}
              onStop={onStop}
              isVideoActive={isVideoActive}
              activeStartSeconds={activeStartSeconds}
            />
          </div>
        </div>
      )}

    </div>
  );
});
