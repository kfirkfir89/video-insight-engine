import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  icon: LucideIcon;
  label: string;
  className?: string;
}

/**
 * Compact section header used by all persona views.
 * Renders an icon + uppercase label as a visual group separator.
 */
export function SectionHeader({ icon: Icon, label, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/70', className)}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
