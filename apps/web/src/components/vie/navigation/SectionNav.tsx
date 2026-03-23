import { memo } from 'react';
import { cn } from '@/lib/utils';

interface SectionNavProps {
  sections: Array<{ id: string; label: string }>;
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
}

/**
 * Vertical or horizontal section navigator.
 * Used for grouping content (e.g. days in itinerary, muscle groups).
 */
export const SectionNav = memo(function SectionNav({
  sections,
  activeId,
  onSelect,
  className,
}: SectionNavProps) {
  return (
    <nav className={cn('flex gap-1 overflow-x-auto scrollbar-none', className)} aria-label="Sections">
      {sections.map((section) => {
        const isActive = section.id === activeId;
        return (
          <button
            key={section.id}
            onClick={() => onSelect(section.id)}
            className={cn(
              'shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/60',
            )}
            aria-current={isActive ? 'true' : undefined}
          >
            {section.label}
          </button>
        );
      })}
    </nav>
  );
});
