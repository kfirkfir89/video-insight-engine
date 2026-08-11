interface RangePickerProps {
  value: number;
  onChange: (days: number) => void;
  options?: number[];
  className?: string;
}

const DEFAULT_OPTIONS = [7, 30, 90];

export function RangePicker({ value, onChange, options = DEFAULT_OPTIONS, className }: RangePickerProps) {
  const classes = [
    'inline-flex gap-0.5 p-0.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div role="group" aria-label="Date range" className={classes} data-testid="range-picker">
      {options.map((days) => {
        const isActive = days === value;
        const base = 'px-2.5 py-1 text-xs rounded-md transition-colors font-medium';
        const state = isActive
          ? 'bg-[var(--color-primary)] text-white'
          : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-dim)] hover:text-[var(--color-text)]';
        return (
          <button
            key={days}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(days)}
            className={`${base} ${state}`}
          >
            {days}d
          </button>
        );
      })}
    </div>
  );
}
