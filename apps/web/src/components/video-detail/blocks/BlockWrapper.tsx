import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

type BlockVariant = 'card' | 'inline' | 'accent' | 'code' | 'transparent';
type AccentColor = 'primary' | 'destructive' | 'success' | 'warning' | 'info';

interface BlockWrapperProps {
  /** Stable block ID for tracking and analytics */
  blockId?: string;
  /** Accessible label for screen readers */
  label?: string;
  /** ARIA role (defaults to region) */
  role?: string;
  /** Visual variant */
  variant?: BlockVariant;
  /** Accent color for accent variant top fade-edge */
  accentColor?: AccentColor;
  /** Lucide icon element for auto-rendered header */
  headerIcon?: ReactNode;
  /** Label text for auto-rendered header */
  headerLabel?: string;
  /** Optional action element in header (e.g. button) */
  headerAction?: ReactNode;
  /** Enable entrance animation */
  animate?: boolean;
  /** Stagger index for animation delay */
  index?: number;
  /** Additional CSS classes */
  className?: string;
  /** Block content */
  children: ReactNode;
}

const variantClasses: Record<BlockVariant, string> = {
  card: 'block-card',
  inline: 'block-inline',
  accent: 'block-accent',
  code: 'block-code-container',
  transparent: '',
};

const accentColorStyles: Record<AccentColor, React.CSSProperties> = {
  primary: { '--accent-line-color': 'var(--primary)' } as React.CSSProperties,
  destructive: { '--accent-line-color': 'var(--destructive)' } as React.CSSProperties,
  success: { '--accent-line-color': 'var(--success)' } as React.CSSProperties,
  warning: { '--accent-line-color': 'var(--warning)' } as React.CSSProperties,
  info: { '--accent-line-color': 'var(--info)' } as React.CSSProperties,
};

/**
 * Visual + accessibility wrapper for all content blocks.
 * Provides variant-based styling, optional auto-rendered header,
 * data attributes for testing/analytics, and ARIA support.
 */
export function BlockWrapper({
  blockId,
  label,
  role = 'region',
  variant = 'card',
  accentColor,
  headerIcon,
  headerLabel,
  headerAction,
  animate,
  index,
  className,
  children,
}: BlockWrapperProps) {
  const hasHeader = headerIcon || headerLabel;

  return (
    <section
      data-block-id={blockId}
      role={role}
      aria-label={label}
      className={cn(
        'block-container',
        variantClasses[variant],
        animate && 'block-entrance',
        className
      )}
      style={{
        ...(animate && index !== undefined ? { animationDelay: `${index * 75}ms` } : {}),
        ...(variant === 'accent' && accentColor ? accentColorStyles[accentColor] : {}),
      }}
    >
      {hasHeader && variant === 'card' && (
        <div className="block-card-header">
          {headerIcon && (
            <span className="block-card-header-icon" aria-hidden="true">
              {headerIcon}
            </span>
          )}
          {headerLabel && (
            <span className="block-card-header-label">{headerLabel}</span>
          )}
          {headerAction}
        </div>
      )}
      {hasHeader && variant === 'code' && (
        <div className="block-code-header">
          {/* Traffic light dots */}
          <div className="flex items-center gap-1.5 mr-2" aria-hidden="true">
            <span className="code-traffic-light code-traffic-light-close" />
            <span className="code-traffic-light code-traffic-light-minimize" />
            <span className="code-traffic-light code-traffic-light-maximize" />
          </div>
          {headerIcon && (
            <span className="text-success/70" aria-hidden="true">
              {headerIcon}
            </span>
          )}
          {headerLabel && (
            <span className="flex-1 text-xs font-medium text-[var(--code-muted)]">
              {headerLabel}
            </span>
          )}
          {headerAction}
        </div>
      )}
      {children}
    </section>
  );
}
