import { memo } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';

interface SectionNavProps {
  sections: Array<{ id: string; label: string }>;
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
  layoutGroup?: string;
}

export const SectionNav = memo(function SectionNav({
  sections,
  activeId,
  onSelect,
  className,
  layoutGroup = 'section-nav-default',
}: SectionNavProps) {
  return (
    <nav className={cn('flex gap-1 overflow-x-auto scrollbar-none scroll-fade-x', className)} aria-label="Sections">
      {sections.map((section) => {
        const isActive = section.id === activeId;
        return (
          <button
            key={section.id}
            onClick={() => onSelect(section.id)}
            className={cn(
              'relative shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              isActive ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
            aria-current={isActive ? 'true' : undefined}
          >
            {isActive && (
              <motion.span
                layoutId={layoutGroup}
                className="absolute inset-0 rounded-md bg-primary shadow-[0_4px_12px_-4px_oklch(from_var(--primary)_l_c_h_/_0.45)]"
                transition={springs.soft}
                aria-hidden="true"
              />
            )}
            {!isActive && (
              <span className="absolute inset-0 rounded-md bg-muted/30 opacity-0 hover:opacity-100 transition-opacity" aria-hidden="true" />
            )}
            <span className="relative">{section.label}</span>
          </button>
        );
      })}
    </nav>
  );
});
