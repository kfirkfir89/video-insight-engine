import { useMemo } from 'react';
import type { ContentBlock } from '@vie/types';

/**
 * Configuration for block grouping.
 * Each key is a group name, value is a matcher function.
 */
export type BlockGroupConfig<T extends string> = {
  [K in T]: (block: ContentBlock) => boolean;
};

/**
 * Result type for grouped blocks.
 */
export type BlockGroups<T extends string> = {
  [K in T]: ContentBlock[];
} & {
  other: ContentBlock[];
};

/**
 * Hook to group content blocks by type for specialized view layouts.
 *
 * @example
 * ```tsx
 * const groups = useBlockGroups(section.content, {
 *   timers: (b) => b.type === 'workout_timer',
 *   exercises: (b) => b.type === 'exercise',
 *   tips: (b) => b.type === 'callout' && b.variant === 'form_tip',
 * });
 *
 * // groups.timers, groups.exercises, groups.tips, groups.other
 * ```
 */
export function useBlockGroups<T extends string>(
  content: ContentBlock[] | undefined,
  config: BlockGroupConfig<T>
): BlockGroups<T> {
  return useMemo(() => {
    const groups: Record<string, ContentBlock[]> = {};
    const other: ContentBlock[] = [];

    // Initialize all groups
    for (const key of Object.keys(config)) {
      groups[key] = [];
    }

    // Sort blocks into groups
    for (const block of content ?? []) {
      let matched = false;
      for (const [key, matcher] of Object.entries(config) as [string, (block: ContentBlock) => boolean][]) {
        if (matcher(block)) {
          groups[key].push(block);
          matched = true;
          break;
        }
      }
      if (!matched) {
        other.push(block);
      }
    }

    return { ...groups, other } as BlockGroups<T>;
  }, [content, config]);
}

/**
 * Check if any group has items.
 */
export function hasAnyBlocks<T extends string>(groups: BlockGroups<T>): boolean {
  return Object.values(groups).some((arr) => (arr as ContentBlock[]).length > 0);
}
