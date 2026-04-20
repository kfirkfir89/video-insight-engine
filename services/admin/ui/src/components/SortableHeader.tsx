import type { ReactNode } from 'react';

type SortDirection = 'asc' | 'desc';

interface SortableHeaderProps {
  children: ReactNode;
  sortKey: string;
  currentKey: string | null;
  direction: SortDirection;
  onToggle: (key: string) => void;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

function ChevronUp() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2 6.5L5 3.5L8 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronBoth() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2 4L5 1.5L8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 6L5 8.5L8 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SortableHeader({
  children,
  sortKey,
  currentKey,
  direction,
  onToggle,
  align = 'left',
  className,
}: SortableHeaderProps) {
  const isActive = currentKey === sortKey;
  const ariaSort: 'ascending' | 'descending' | 'none' = isActive
    ? direction === 'asc'
      ? 'ascending'
      : 'descending'
    : 'none';

  const justify = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
  const weight = isActive ? 'text-[var(--color-text)] font-semibold' : 'text-[var(--color-text-muted)] font-medium';
  const classes = [
    'inline-flex items-center gap-1 w-full',
    justify,
    weight,
    'hover:text-[var(--color-text)] transition-colors',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      aria-sort={ariaSort}
      onClick={() => onToggle(sortKey)}
      className={classes}
      data-testid={`sort-${sortKey}`}
    >
      <span>{children}</span>
      <span className={isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-faint)]'}>
        {isActive ? direction === 'asc' ? <ChevronUp /> : <ChevronDown /> : <ChevronBoth />}
      </span>
    </button>
  );
}
