import { memo, type ReactNode } from 'react';
import { Clock } from 'lucide-react';
import type { SummaryChapter } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';
import { useGroupedBlocks, type BlockGroupRule } from '@/hooks/use-grouped-blocks';
import { useAutoFlowLayout } from '@/hooks/use-auto-flow-layout';
import type { FlowRow } from '@/lib/auto-flow-layout';
import { ViewLayout, LayoutRow, LayoutColumn, LayoutSection, renderSections } from './ViewLayout';

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

interface FlowRowRendererProps {
  row: FlowRow;
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isVideoActive?: boolean;
  activeStartSeconds?: number;
}

function FlowRowRenderer({ row, ...blockProps }: FlowRowRendererProps) {
  if (row.type === 'full') {
    return <ContentBlocks blocks={row.columns[0]} {...blockProps} />;
  }

  if (row.type === 'sidebar-main') {
    return (
      <LayoutRow>
        <LayoutColumn width="sidebar">
          <ContentBlocks blocks={row.columns[0]} {...blockProps} />
        </LayoutColumn>
        <LayoutColumn width="main">
          <ContentBlocks blocks={row.columns[1]} {...blockProps} />
        </LayoutColumn>
      </LayoutRow>
    );
  }

  // equal-2
  return (
    <LayoutRow>
      <LayoutColumn width="equal">
        <ContentBlocks blocks={row.columns[0]} {...blockProps} />
      </LayoutColumn>
      <LayoutColumn width="equal">
        <ContentBlocks blocks={row.columns[1]} {...blockProps} />
      </LayoutColumn>
    </LayoutRow>
  );
}

/**
 * Standard/default view for general content.
 * Uses auto-flow layout engine to intelligently pair sidebar-compatible
 * blocks with full-width blocks. Timestamps extracted to bottom.
 */
export const StandardView = memo(function StandardView({
  chapter,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
}: StandardViewProps) {
  const groups = useGroupedBlocks(chapter.content, STANDARD_RULES);
  const flowRows = useAutoFlowLayout(groups.other);

  const blockProps = { onPlay, onStop, isVideoActive, activeStartSeconds };

  const sections: { key: string; node: ReactNode }[] = [];

  if (flowRows.length > 0) {
    sections.push({ key: 'content', node: (
      <div className="space-y-6">
        {flowRows.map((row, index) => (
          <FlowRowRenderer key={`flow-${index}-${row.type}`} row={row} {...blockProps} />
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
