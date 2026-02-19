import { useMemo } from 'react';
import type { ContentBlock } from '@vie/types';
import { ContentBlockRenderer } from './ContentBlockRenderer';
import { ErrorBoundary } from '../ui/error-boundary';
import { groupBlocksBySize, computeSpacingMap, type BlockGroup } from '@/lib/block-layout';

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

const GROUP_GRID_CLASSES: Record<BlockGroup['size'], string> = {
  full: '',
  half: 'grid grid-cols-1 md:grid-cols-2 gap-3',
  compact: 'grid grid-cols-2 md:grid-cols-3 gap-3',
};

/**
 * Container for rendering multiple content blocks with smart grid layout
 * and progressive spacing.
 *
 * Groups consecutive blocks by size classification:
 * - full: vertical stack (default)
 * - half: 2-column grid on desktop
 * - compact: 2-3 column grid on desktop
 *
 * Spacing between blocks/groups is computed via computeSpacingMap()
 * based on the previous and current block types (prose→code = wide gap,
 * prose→prose = tight gap, etc.).
 *
 * Each block is wrapped in an ErrorBoundary to prevent a single malformed
 * block from crashing the entire section.
 */
export function ContentBlocks({ blocks, onSeek, onPlay, onStop, isVideoActive, activeStartSeconds }: ContentBlocksProps) {
  const groups = useMemo(() => groupBlocksBySize(blocks), [blocks]);
  // Pre-compute block→index map for stable React keys (O(n) vs O(n²) indexOf)
  const blockIndex = useMemo(() => new Map(blocks.map((b, i) => [b, i])), [blocks]);

  const spacingMap = useMemo(
    () => computeSpacingMap(groups, GROUP_GRID_CLASSES),
    [groups],
  );

  if (!blocks.length) {
    return null;
  }

  return (
    <div>
      {groups.map((group) => {
        const firstBlock = group.blocks[0];
        const groupKey = `${firstBlock.type}-${blockIndex.get(firstBlock)}`;
        // Single orphan half/compact block renders full-width
        const isSingleOrphan = group.blocks.length === 1 && group.size !== 'full';
        const gridClass = isSingleOrphan ? '' : GROUP_GRID_CLASSES[group.size];

        const spacingClass = spacingMap.get(firstBlock) ?? '';

        if (gridClass) {
          return (
            <div key={groupKey} className={`${gridClass} ${spacingClass}`} data-block-type={firstBlock.type}>
              {group.blocks.map((block) => (
                <ErrorBoundary key={`${block.type}-${blockIndex.get(block)}`} fallback={null}>
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

        // Full-width group or single orphan: render blocks in vertical stack
        return group.blocks.map((block) => (
          <div key={`${block.type}-${blockIndex.get(block)}`} className={spacingMap.get(block) ?? ''} data-block-type={block.type}>
            <ErrorBoundary fallback={null}>
              <ContentBlockRenderer
                block={block}
                onSeek={onSeek}
                onPlay={onPlay}
                onStop={onStop}
                isVideoActive={isVideoActive}
                activeStartSeconds={activeStartSeconds}
              />
            </ErrorBoundary>
          </div>
        ));
      })}
    </div>
  );
}
