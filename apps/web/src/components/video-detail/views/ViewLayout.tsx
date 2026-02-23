import { Fragment, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionHeader } from './SectionHeader';

// ─────────────────────────────────────────────────────
// ViewLayout — root container with auto fade-dividers
// ─────────────────────────────────────────────────────

interface ViewLayoutProps {
  children: ReactNode;
  className?: string;
}

/**
 * Root container for view layouts.
 * Renders children with `space-y-6` spacing and fade-dividers between them.
 * Use with `ViewLayout.sections()` helper or compose manually.
 */
export function ViewLayout({ children, className }: ViewLayoutProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// LayoutRow — horizontal multi-column row
// ─────────────────────────────────────────────────────

interface LayoutRowProps {
  children: ReactNode;
  gap?: 'gap-2' | 'gap-3' | 'gap-4' | 'gap-6';
  reverse?: boolean;
  className?: string;
}

/**
 * Horizontal row that stacks columns vertically on mobile, side-by-side on md+.
 */
export function LayoutRow({ children, gap = 'gap-4', reverse, className }: LayoutRowProps) {
  return (
    <div className={cn('flex flex-col md:flex-row', gap, reverse && 'md:flex-row-reverse', className)}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// LayoutColumn — column within a LayoutRow
// ─────────────────────────────────────────────────────

type ColumnWidth = 'sidebar' | 'main' | 'equal';

interface LayoutColumnProps {
  children: ReactNode;
  width?: ColumnWidth;
  className?: string;
}

const WIDTH_CLASSES: Record<ColumnWidth, string> = {
  sidebar: 'md:w-[280px] shrink-0',
  main: 'flex-1 min-w-0',
  equal: 'flex-1 min-w-0',
};

/**
 * Column within a LayoutRow.
 * - `sidebar`: fixed 280px on md+
 * - `main`: fills remaining space
 * - `equal`: flex-1 (default)
 */
export function LayoutColumn({ children, width = 'equal', className }: LayoutColumnProps) {
  return (
    <div className={cn(WIDTH_CLASSES[width], className)}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// LayoutSection — optional SectionHeader + children
// ─────────────────────────────────────────────────────

interface LayoutSectionProps {
  children: ReactNode;
  icon?: LucideIcon;
  label?: string;
  className?: string;
}

/**
 * Wraps content with an optional SectionHeader.
 */
export function LayoutSection({ children, icon, label, className }: LayoutSectionProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {icon && label && <SectionHeader icon={icon} label={label} />}
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// buildPairedSection — two-column section builder
// ─────────────────────────────────────────────────────

interface Section {
  key: string;
  node: ReactNode;
}

/**
 * Builds a Section containing a LayoutRow with two columns.
 * Eliminates repeated LayoutRow/LayoutColumn boilerplate across views.
 */
export function buildPairedSection(
  left: { width: ColumnWidth; node: ReactNode },
  right: { width: ColumnWidth; node: ReactNode },
  key = 'top-row',
): Section {
  return {
    key,
    node: (
      <LayoutRow>
        <LayoutColumn width={left.width}>{left.node}</LayoutColumn>
        <LayoutColumn width={right.width}>{right.node}</LayoutColumn>
      </LayoutRow>
    ),
  };
}

/**
 * When both sides have content → pair them side-by-side in a row.
 * When only one side has content → return it as a standalone section.
 *
 * Eliminates the repeated if(hasBoth)/else{stack} pattern across views.
 * Best for simple cases where paired and fallback nodes are identical.
 * For composite columns with different fallback decomposition, use
 * buildPairedSection with explicit if/else instead.
 */
export function buildPairedOrStack(
  left: { key: string; width: ColumnWidth; node: ReactNode | null },
  right: { key: string; width: ColumnWidth; node: ReactNode | null },
  pairKey?: string,
): Section[] {
  if (left.node != null && right.node != null) {
    return [buildPairedSection(
      { width: left.width, node: left.node },
      { width: right.width, node: right.node },
      pairKey,
    )];
  }
  const result: Section[] = [];
  if (left.node != null) result.push({ key: left.key, node: left.node });
  if (right.node != null) result.push({ key: right.key, node: right.node });
  return result;
}

// ─────────────────────────────────────────────────────
// renderSections — helper to render sections with dividers
// ─────────────────────────────────────────────────────

/**
 * Renders an array of sections with fade-dividers between them.
 * Convenience helper that replaces the manual Fragment+divider pattern in views.
 */
export function renderSections(sections: Section[]): ReactNode {
  if (sections.length === 0) return null;

  return sections.map((section, i) => (
    <Fragment key={section.key}>
      {i > 0 && <div className="fade-divider" />}
      {section.node}
    </Fragment>
  ));
}
