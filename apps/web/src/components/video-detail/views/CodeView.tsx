import { Fragment, memo, type ReactNode } from 'react';
import { Code2, GitCompare, Clock } from 'lucide-react';
import type { SummaryChapter } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';
import { useGroupedBlocks, type BlockGroupRule } from '@/hooks/use-grouped-blocks';
import { SectionHeader } from './SectionHeader';

interface CodeViewProps {
  chapter: SummaryChapter;
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isVideoActive?: boolean;
  activeStartSeconds?: number;
}

const CODE_RULES: readonly BlockGroupRule[] = [
  { name: 'code', match: (b) => b.type === 'example' || (b.type === 'bullets' && b.variant === 'terminal_command') },
  { name: 'comparisons', match: (b) => b.type === 'comparison' },
  { name: 'timestamps', match: (b) => b.type === 'timestamp' },
];

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
  const groups = useGroupedBlocks(chapter.content, CODE_RULES);

  const blockProps = { onPlay, onStop, isVideoActive, activeStartSeconds };

  const sections: { key: string; node: ReactNode }[] = [];

  if (groups.other.length > 0) {
    sections.push({ key: 'other', node: (
      <ContentBlocks blocks={groups.other} {...blockProps} />
    )});
  }

  if (groups.code.length > 0) {
    sections.push({ key: 'code', node: (
      <div className="space-y-2">
        <SectionHeader icon={Code2} label="Code Examples" />
        <ContentBlocks blocks={groups.code} {...blockProps} />
      </div>
    )});
  }

  if (groups.comparisons.length > 0) {
    sections.push({ key: 'comparisons', node: (
      <div className="space-y-2">
        <SectionHeader icon={GitCompare} label="Comparisons" />
        <ContentBlocks blocks={groups.comparisons} {...blockProps} />
      </div>
    )});
  }

  if (groups.timestamps.length > 0) {
    sections.push({ key: 'timestamps', node: (
      <div className="space-y-2">
        <SectionHeader icon={Clock} label="Timestamps" />
        <div className="flex flex-wrap gap-2">
          <ContentBlocks blocks={groups.timestamps} {...blockProps} />
        </div>
      </div>
    )});
  }

  if (sections.length === 0) return null;

  return (
    <div className="space-y-6">
      {sections.map((section, i) => (
        <Fragment key={section.key}>
          {i > 0 && <div className="fade-divider" />}
          {section.node}
        </Fragment>
      ))}
    </div>
  );
});
