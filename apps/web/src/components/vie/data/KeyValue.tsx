import { memo, type ReactNode } from 'react';
import { Cpu, DollarSign, BarChart3, Info, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KeyValueItem {
  key: string;
  value: string;
}

type KeyValueVariant = 'specs' | 'cost' | 'stats' | 'info' | 'location';

const VARIANT_CONFIG: Record<KeyValueVariant, { icon: typeof Info; label: string }> = {
  specs: { icon: Cpu, label: 'specifications' },
  cost: { icon: DollarSign, label: 'cost breakdown' },
  stats: { icon: BarChart3, label: 'statistics' },
  info: { icon: Info, label: 'details' },
  location: { icon: MapPin, label: 'location' },
};

interface KeyValueProps {
  items: KeyValueItem[];
  variant?: KeyValueVariant;
  icon?: ReactNode;
  label?: string;
  className?: string;
}

export const KeyValue = memo(function KeyValue({
  items,
  variant,
  icon: iconProp,
  label: labelProp,
  className,
}: KeyValueProps) {
  const variantConfig = variant ? VARIANT_CONFIG[variant] ?? VARIANT_CONFIG.info : null;
  const icon = iconProp ?? (variantConfig ? <variantConfig.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null);
  const label = labelProp ?? (variantConfig ? variantConfig.label : undefined);
  if (items.length === 0) return null;

  return (
    <div className={cn('space-y-1.5', className)}>
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
      <dl className="space-y-0">
        {items.map((item, index) => (
          <div key={index} className="animate-fade-up" style={{ animationDelay: `${index * 50 + 60}ms` }}>
            <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm even:bg-muted/[0.04]">
              <dt className="text-xs font-semibold uppercase text-muted-foreground/70 tracking-wider">{item.key}</dt>
              <dd className="text-sm font-medium tabular-nums text-foreground">{item.value}</dd>
            </div>
            {index < items.length - 1 && <div className="fade-divider" aria-hidden="true" />}
          </div>
        ))}
      </dl>
    </div>
  );
});
