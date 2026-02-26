import { memo } from 'react';
import type { FlowRow, FlowRowType } from '@/lib/auto-flow-layout';
import { ContentBlocks } from './ContentBlocks';
import { LayoutRow, LayoutColumn } from './views/ViewLayout';

interface FlowRowRendererProps {
  row: FlowRow;
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isVideoActive?: boolean;
  activeStartSeconds?: number;
}

/**
 * CSS grid class mapping for equal-column row types.
 * These classes are defined in index.css under "FLOW GRID" section
 * and use CSS container queries for responsive column counts.
 */
const EQUAL_GRID_CLASS: Partial<Record<FlowRowType, string>> = {
  'equal-2': 'flow-grid-equal-2',
  'equal-3': 'flow-grid-equal-3',
  'equal-4': 'flow-grid-equal-4',
};

/**
 * Renders a single FlowRow using the appropriate layout.
 * Supports 5 row types: full, sidebar-main, equal-2, equal-3, equal-4.
 */
export const FlowRowRenderer = memo(function FlowRowRenderer({ row, ...blockProps }: FlowRowRendererProps) {
  // full: single column, full width
  if (row.type === 'full') {
    return <ContentBlocks blocks={row.columns[0]} {...blockProps} />;
  }

  // sidebar-main: sidebar (280px) + main (flex)
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

  // equal-2 / equal-3 / equal-4: N equal columns via container-query grid
  if (row.type === 'equal-2' || row.type === 'equal-3' || row.type === 'equal-4') {
    const gridClass = EQUAL_GRID_CLASS[row.type]!;
    return (
      <div className={gridClass}>
        {row.columns.map((col, i) => (
          <ContentBlocks key={col[0]?.blockId ?? `flow-col-${row.type}-${i}`} blocks={col} {...blockProps} />
        ))}
      </div>
    );
  }

  // Exhaustive check: TypeScript will error here if a new FlowRowType
  // is added without a corresponding case above.
  const _exhaustive: never = row.type;
  void _exhaustive;
  return <ContentBlocks blocks={row.columns[0]} {...blockProps} />;
});
