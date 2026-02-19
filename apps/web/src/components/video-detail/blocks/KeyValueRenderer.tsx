import { memo } from 'react';
import type { KeyValueBlock } from '@vie/types';
import { Cpu, DollarSign, BarChart3, Info, MapPin } from 'lucide-react';
import { BlockWrapper } from './BlockWrapper';
import { ConceptHighlighter } from '../ConceptHighlighter';

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
    <BlockWrapper
      blockId={block.blockId}
      variant="transparent"
      label={config.label}
    >
      <div className="space-y-1.5">
        {/* Header with icon */}
        <div className="flex items-center gap-1.5 mb-1">
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />
          <span className="text-xs text-muted-foreground/70">{config.label}</span>
        </div>

        {/* Key-value rows with fade dividers */}
        <dl className="space-y-0">
          {block.items.map((item, index) => (
            <div key={index}>
              <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm even:bg-muted/[0.04]">
                <dt className="text-xs font-bold uppercase text-muted-foreground/70 tracking-wide">{item.key}</dt>
                <dd className="text-sm font-medium text-muted-foreground"><ConceptHighlighter text={item.value} /></dd>
              </div>
              {index < block.items.length - 1 && (
                <div className="fade-divider" aria-hidden="true" />
              )}
            </div>
          ))}
        </dl>
      </div>
    </BlockWrapper>
  );
});
