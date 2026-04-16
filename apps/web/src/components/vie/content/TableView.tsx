import { memo } from 'react';
import { cn } from '@/lib/utils';

interface TableColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
}

interface TableViewProps {
  columns: TableColumn[];
  rows: Array<Record<string, unknown>>;
  /** Row indices to visually highlight */
  highlightRows?: number[];
  caption?: string;
  className?: string;
}

const ALIGN_CLASS: Record<string, string> = {
  left: 'text-start',
  center: 'text-center',
  right: 'text-end',
};

/**
 * Domain-free data table with column alignment and row highlighting.
 */
export const TableView = memo(function TableView({
  columns,
  rows,
  highlightRows,
  caption,
  className,
}: TableViewProps) {
  if (rows.length === 0 || columns.length === 0) return null;

  const highlightSet = new Set(highlightRows ?? []);

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-sm table-fade-dividers">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn('px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground', ALIGN_CLASS[col.align ?? 'left'])}
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
                  isHighlighted && 'bg-primary/[0.06] shadow-[inset_3px_0_0_var(--primary)]',
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-2 text-sm leading-relaxed',
                      ALIGN_CLASS[col.align ?? 'left'],
                      typeof row[col.key] === 'number' && 'tabular-nums font-medium',
                    )}
                  >
                    {row[col.key] != null ? String(row[col.key]) : ''}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});
