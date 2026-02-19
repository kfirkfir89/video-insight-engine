import { memo } from 'react';
import type { SummaryChapter } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';

interface StandardViewProps {
  chapter: SummaryChapter;
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isVideoActive?: boolean;
  activeStartSeconds?: number;
}

/**
 * Standard/default view for general content.
 * Renders all blocks in their natural order with balanced styling.
 * Used as fallback when no specialized persona is detected.
 */
export const StandardView = memo(function StandardView({
  chapter,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
}: StandardViewProps) {
  const blocks = chapter.content ?? [];

  // Early return for empty content to avoid rendering empty wrapper
  if (blocks.length === 0) {
    return null;
  }

  return (
    <ContentBlocks
      blocks={blocks}
      onPlay={onPlay}
      onStop={onStop}
      isVideoActive={isVideoActive}
      activeStartSeconds={activeStartSeconds}
    />
  );
});
