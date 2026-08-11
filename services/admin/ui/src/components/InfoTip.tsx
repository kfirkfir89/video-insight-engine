import { useId } from 'react';
import type { ReactNode } from 'react';

interface InfoTipProps {
  children: ReactNode;
  label?: string;
}

function InfoCircle({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export function InfoTip({ children, label = 'More info' }: InfoTipProps) {
  const tooltipId = useId();

  return (
    <span className="relative inline-flex group">
      <button
        type="button"
        aria-label={label}
        aria-describedby={tooltipId}
        className="inline-flex items-center justify-center text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)] focus:text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-full transition-colors"
      >
        <InfoCircle size={14} />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 max-w-xs w-max rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] text-xs text-[var(--color-text)] shadow-md px-2 py-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-opacity z-50"
      >
        {children}
      </span>
    </span>
  );
}
