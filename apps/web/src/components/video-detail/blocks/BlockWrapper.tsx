import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface BlockWrapperProps {
  /** Stable block ID for tracking and analytics */
  blockId?: string;
  /** Accessible label for screen readers */
  label?: string;
  /** ARIA role (defaults to region) */
  role?: string;
  /** Additional CSS classes */
  className?: string;
  /** Block content */
  children: ReactNode;
}

/**
 * Accessibility wrapper for all content blocks.
 * Provides consistent data attributes for testing/analytics and ARIA support.
 */
export function BlockWrapper({
  blockId,
  label,
  role = 'region',
  className,
  children,
}: BlockWrapperProps) {
  return (
    <section
      data-block-id={blockId}
      role={role}
      aria-label={label}
      className={cn('block-container', className)}
    >
      {children}
    </section>
  );
}
