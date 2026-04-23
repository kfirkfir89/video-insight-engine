import { memo, type ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';

interface ListItemsProps {
  items: string[];
  icon?: ReactNode;
  label?: string;
  className?: string;
}

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
        <div className="flex items-center gap-1.5 mb-2 animate-fade-up">
          {icon && (
            <span className="text-muted-foreground/70 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0" aria-hidden="true">
              {icon}
            </span>
          )}
          {label && (
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">{label}</span>
          )}
        </div>
      )}
      <ul className="space-y-0">
        {items.map((item, index) => (
          <li key={index} className="animate-fade-up" style={{ animationDelay: `${index * 50 + 80}ms` }}>
            <div className="flex items-baseline gap-2 text-sm py-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-success/60" aria-hidden="true" />
              <span className="text-muted-foreground leading-relaxed text-pretty">{item}</span>
            </div>
            {index < items.length - 1 && <div className="fade-divider" aria-hidden="true" />}
          </li>
        ))}
      </ul>
    </div>
  );
});
