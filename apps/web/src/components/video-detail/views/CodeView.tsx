import { memo, type ReactNode } from 'react';
import { Code2, GitCompare, Clock, BarChart3 } from 'lucide-react';
import type { SummaryChapter, ContentBlockType } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';
import { useGroupedBlocks, type BlockGroupRule } from '@/hooks/use-grouped-blocks';
import { useBlockProps } from '@/hooks/use-block-props';
import { ViewLayout, LayoutSection, sidebarMainOrFallback, renderSections } from './ViewLayout';

interface CodeViewProps {
  chapter: SummaryChapter;
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isVideoActive?: boolean;
  activeStartSeconds?: number;
}

const CODE_BLOCK_TYPES = new Set<ContentBlockType>(['code', 'terminal', 'file_tree', 'example']);

const CODE_RULES: readonly BlockGroupRule[] = [
  { name: 'code', match: (b) => CODE_BLOCK_TYPES.has(b.type) || (b.type === 'bullets' && b.variant === 'terminal_command') },
  { name: 'stats', match: (b) => b.type === 'statistic' },
  { name: 'comparisons', match: (b) => b.type === 'comparison' },
  { name: 'timestamps', match: (b) => b.type === 'timestamp' },
];

/**
 * Specialized view for code/programming content.
 * Emphasizes:
 * - Code examples and terminal commands
 * - Statistics in sidebar when available
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
  const groups = useGroupedBlocks(chapter.content, CODE_RULES);

  const blockProps = useBlockProps(onPlay, onStop, isVideoActive, activeStartSeconds);

  const sections: { key: string; node: ReactNode }[] = [];

  const hasStats = groups.stats.length > 0;
  const hasOther = groups.other.length > 0;
  const hasCode = groups.code.length > 0;

  const fallback: { key: string; node: ReactNode }[] = [];
  if (hasStats) fallback.push({ key: 'stats', node: (
    <LayoutSection icon={BarChart3} label="Stats">
      <ContentBlocks blocks={groups.stats} {...blockProps} />
    </LayoutSection>
  )});
  if (hasOther) fallback.push({ key: 'other', node: (
    <ContentBlocks blocks={groups.other} {...blockProps} />
  )});
  if (hasCode) fallback.push({ key: 'code', node: (
    <LayoutSection icon={Code2} label="Code Examples">
      <ContentBlocks blocks={groups.code} {...blockProps} />
    </LayoutSection>
  )});

  sections.push(...sidebarMainOrFallback(
    hasStats ? (
      <LayoutSection icon={BarChart3} label="Stats">
        <ContentBlocks blocks={groups.stats} {...blockProps} />
      </LayoutSection>
    ) : null,
    (hasOther || hasCode) ? (
      <>
        {hasOther && <ContentBlocks blocks={groups.other} {...blockProps} />}
        {hasCode && (
          <div className={hasOther ? 'mt-6' : ''}>
            <LayoutSection icon={Code2} label="Code Examples">
              <ContentBlocks blocks={groups.code} {...blockProps} />
            </LayoutSection>
          </div>
        )}
      </>
    ) : null,
    fallback,
  ));

  if (groups.comparisons.length > 0) {
    sections.push({ key: 'comparisons', node: (
      <LayoutSection icon={GitCompare} label="Comparisons">
        <ContentBlocks blocks={groups.comparisons} {...blockProps} />
      </LayoutSection>
    )});
  }

  if (groups.timestamps.length > 0) {
    sections.push({ key: 'timestamps', node: (
      <LayoutSection icon={Clock} label="Timestamps">
        <div className="flex flex-wrap gap-2">
          <ContentBlocks blocks={groups.timestamps} {...blockProps} />
        </div>
      </LayoutSection>
    )});
  }

  if (sections.length === 0) return null;

  return (
    <ViewLayout>
      {renderSections(sections)}
    </ViewLayout>
  );
});
