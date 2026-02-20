import { memo } from 'react';
import { Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockWrapper } from './BlockWrapper';
import type { TableBlock as TableBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface TableBlockProps {
  block: TableBlockType;
}

const ALIGN_CLASS: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

/**
 * Renders a generic data table with fade-edge dividers, column alignment, and row highlighting.
 */
export const TableBlock = memo(function TableBlock({ block }: TableBlockProps) {
  const rows = block.rows ?? [];
  const columns = block.columns ?? [];

  if (rows.length === 0 || columns.length === 0) return null;

  const highlightSet = new Set(block.highlightRows ?? []);

  return (
    <BlockWrapper
      blockId={block.blockId}
      label={block.caption ?? BLOCK_LABELS.table}
      variant="card"
      headerIcon={<Table2 className="h-4 w-4" />}
      headerLabel={block.caption ?? BLOCK_LABELS.table}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm table-fade-dividers">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-2.5 font-medium text-foreground',
                    ALIGN_CLASS[col.align ?? 'left']
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="stagger-children">
            {rows.map((row, rowIndex) => {
              const isHighlighted = highlightSet.has(rowIndex);
              return (
                <tr
                  key={rowIndex}
                  className={cn(
                    'even:bg-muted/[0.08] hover:bg-muted/20 transition-colors',
                    isHighlighted && 'bg-primary/[0.06] shadow-[inset_3px_0_0_var(--primary)]'
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-2',
                        ALIGN_CLASS[col.align ?? 'left'],
                        typeof row[col.key] === 'number' && 'tabular-nums font-medium'
                      )}
                    >
                      {row[col.key] ?? ''}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </BlockWrapper>
  );
});
