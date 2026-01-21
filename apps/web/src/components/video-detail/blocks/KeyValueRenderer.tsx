import { memo } from 'react';
import type { KeyValueBlock } from '@vie/types';
import { Cpu, DollarSign, BarChart3, Info, MapPin } from 'lucide-react';

interface KeyValueRendererProps {
  block: KeyValueBlock;
}

// Variant configuration with type safety
const VARIANT_CONFIG = {
  specs: { icon: Cpu, label: 'specifications' },
  cost: { icon: DollarSign, label: 'cost breakdown' },
  stats: { icon: BarChart3, label: 'statistics' },
  info: { icon: Info, label: 'details' },
  location: { icon: MapPin, label: 'location' },
} as const;

type VariantKey = keyof typeof VARIANT_CONFIG;

/**
 * Renders a key-value grid with variant-specific styling.
 * Variants: specs (tech blue), cost (green), stats (purple), info (amber), location (slate)
 */
export const KeyValueRenderer = memo(function KeyValueRenderer({ block }: KeyValueRendererProps) {
  const variant = block.variant || 'info';

  // Safe lookup with fallback to 'info' for unknown variants
  const config = VARIANT_CONFIG[variant as VariantKey] ?? VARIANT_CONFIG.info;
  const Icon = config.icon;

  return (
    <div className="space-y-1.5">
      {/* Header with icon */}
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden="true" />
        <span className="text-xs text-muted-foreground/70">{config.label}</span>
      </div>

      {/* Key-value grid */}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {block.items.map((item, index) => (
          <div key={index} className="contents">
            <dt className="text-muted-foreground/70">{item.key}</dt>
            <dd className="text-muted-foreground font-medium">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
});
