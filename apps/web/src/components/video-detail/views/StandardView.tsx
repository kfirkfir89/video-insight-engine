import { Fragment, memo, type ReactNode } from 'react';
import { Clock } from 'lucide-react';
import type { SummaryChapter } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';
import { useGroupedBlocks, type BlockGroupRule } from '@/hooks/use-grouped-blocks';
import { SectionHeader } from './SectionHeader';

interface StandardViewProps {
  chapter: SummaryChapter;
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isVideoActive?: boolean;
  activeStartSeconds?: number;
}

const STANDARD_RULES: readonly BlockGroupRule[] = [
  { name: 'timestamps', match: (b) => b.type === 'timestamp' },
];

/**
 * Standard/default view for general content.
 * Renders all blocks in their natural order with balanced styling.
 * Extracts timestamps to a dedicated section at the bottom.
 * Used as fallback when no specialized persona is detected.
 */
export const StandardView = memo(function StandardView({
  chapter,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
}: StandardViewProps) {
  const groups = useGroupedBlocks(chapter.content, STANDARD_RULES);

  const blockProps = { onPlay, onStop, isVideoActive, activeStartSeconds };

  const sections: { key: string; node: ReactNode }[] = [];

  if (groups.other.length > 0) {
    sections.push({ key: 'content', node: (
      <ContentBlocks blocks={groups.other} {...blockProps} />
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
