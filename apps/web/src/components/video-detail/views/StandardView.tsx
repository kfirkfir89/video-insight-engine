import { memo, type ReactNode } from 'react';
import { Clock } from 'lucide-react';
import type { SummaryChapter } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';
import { FlowRowRenderer } from '../FlowRowRenderer';
import { useGroupedBlocks, type BlockGroupRule } from '@/hooks/use-grouped-blocks';
import { useBlockProps } from '@/hooks/use-block-props';
import { useAutoFlowLayout } from '@/hooks/use-auto-flow-layout';
import { useBlockMeasurements } from '@/hooks/use-block-measurements';
import { ViewLayout, LayoutSection, renderSections } from './ViewLayout';

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
 * Uses auto-flow layout engine with content-aware measurements to
 * intelligently pair sidebar-compatible blocks with full-width blocks.
 * Timestamps extracted to bottom.
 */
export const StandardView = memo(function StandardView({
  chapter,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
}: StandardViewProps) {
  const groups = useGroupedBlocks(chapter.content, STANDARD_RULES);
  const measurements = useBlockMeasurements(groups.other);
  const flowRows = useAutoFlowLayout(groups.other, measurements);

  const blockProps = useBlockProps(onPlay, onStop, isVideoActive, activeStartSeconds);

  const sections: { key: string; node: ReactNode }[] = [];

  if (flowRows.length > 0) {
    sections.push({ key: 'content', node: (
      <div className="space-y-4">
        {flowRows.map((row, index) => (
          <FlowRowRenderer key={row.columns[0]?.[0]?.blockId ?? `flow-${index}`} row={row} {...blockProps} />
        ))}
      </div>
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
