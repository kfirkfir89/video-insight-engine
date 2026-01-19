import type { ContentBlock } from '@vie/types';
import { ContentBlockRenderer } from './ContentBlockRenderer';
import { ErrorBoundary } from '../ui/error-boundary';

interface ContentBlocksProps {
  blocks: ContentBlock[];
}

/**
 * Container for rendering multiple content blocks with consistent spacing.
 * Each block is wrapped in an ErrorBoundary to prevent a single malformed
 * block from crashing the entire section.
 */
export function ContentBlocks({ blocks }: ContentBlocksProps) {
  if (!blocks.length) {
    return null;
  }

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => (
        // Wrap each block in ErrorBoundary - malformed block renders nothing instead of crashing
        <ErrorBoundary key={`${block.type}-${index}`} fallback={null}>
          <ContentBlockRenderer block={block} />
        </ErrorBoundary>
      ))}
    </div>
  );
}
