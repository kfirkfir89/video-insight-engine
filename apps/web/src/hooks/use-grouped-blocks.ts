import { useMemo } from 'react';
import type { ContentBlock } from '@vie/types';

export interface BlockGroupRule {
  /** Group name key */
  name: string;
  /** Predicate to match blocks — first matching rule wins */
  match: (block: ContentBlock) => boolean;
}

/**
 * Groups content blocks by rules. Unmatched blocks go to 'other'.
 * Rules are evaluated in order — first match wins.
 *
 * Define rules as a module-level constant for referential stability.
 */
export function useGroupedBlocks(
  blocks: ContentBlock[] | undefined,
  rules: readonly BlockGroupRule[]
): Record<string, ContentBlock[]> {
  return useMemo(() => {
    const groups: Record<string, ContentBlock[]> = { other: [] };

    for (const rule of rules) {
      groups[rule.name] = [];
    }

    for (const block of blocks ?? []) {
      let matched = false;
      for (const rule of rules) {
        if (rule.match(block)) {
          groups[rule.name].push(block);
          matched = true;
          break;
        }
      }
      if (!matched) {
        groups.other.push(block);
      }
    }

    return groups;
  }, [blocks, rules]);
}
