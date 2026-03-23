import { memo, type ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';

interface ListItemsProps {
  items: string[];
  /** Optional icon/header to show before the list */
  icon?: ReactNode;
  label?: string;
  className?: string;
}

/**
 * Domain-free bullet list.
 * Renders unordered list items with check-circle markers.
 */
export const ListItems = memo(function ListItems({
  items,
  icon,
  label,
  className,
}: ListItemsProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className={className}>
      {(icon || label) && (
        <div className="flex items-center gap-1.5 mb-2">
          {icon && <span className="text-muted-foreground/70 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0" aria-hidden="true">{icon}</span>}
          {label && <span className="text-xs text-muted-foreground/70">{label}</span>}
        </div>
      )}
      <ul className="space-y-0 stagger-children">
        {items.map((item, index) => (
          <li key={index}>
            <div className="flex items-baseline gap-2.5 text-sm py-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-success/50" aria-hidden="true" />
              <span className="text-muted-foreground">{item}</span>
            </div>
            {index < items.length - 1 && (
              <div className="fade-divider" aria-hidden="true" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
});
