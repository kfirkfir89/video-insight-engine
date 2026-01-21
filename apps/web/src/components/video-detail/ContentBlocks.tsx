import type { ContentBlock } from '@vie/types';
import { ContentBlockRenderer } from './ContentBlockRenderer';
import { ErrorBoundary } from '../ui/error-boundary';

interface ContentBlocksProps {
  blocks: ContentBlock[];
  onSeek?: (seconds: number) => void;
  /** Triggers video collapse at timestamp - preferred over onSeek */
  onPlay?: (seconds: number) => void;
  /** Stop video playback */
  onStop?: () => void;
  /** Whether video is currently playing in this section */
  isVideoActive?: boolean;
  /** The timestamp (seconds) currently playing */
  activeStartSeconds?: number;
}

/**
 * Container for rendering multiple content blocks with consistent spacing.
 * Each block is wrapped in an ErrorBoundary to prevent a single malformed
 * block from crashing the entire section.
 */
export function ContentBlocks({ blocks, onSeek, onPlay, onStop, isVideoActive, activeStartSeconds }: ContentBlocksProps) {
  if (!blocks.length) {
    return null;
  }

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => (
        // Wrap each block in ErrorBoundary - malformed block renders nothing instead of crashing
        <ErrorBoundary key={`${block.type}-${index}`} fallback={null}>
          <ContentBlockRenderer
            block={block}
            onSeek={onSeek}
            onPlay={onPlay}
            onStop={onStop}
            isVideoActive={isVideoActive}
            activeStartSeconds={activeStartSeconds}
          />
        </ErrorBoundary>
      ))}
    </div>
  );
}
