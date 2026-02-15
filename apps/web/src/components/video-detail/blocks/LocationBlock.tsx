import { memo } from 'react';
import { MapPin, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockWrapper } from './BlockWrapper';
import type { LocationBlock as LocationBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface LocationBlockProps {
  block: LocationBlockType;
}

/**
 * Renders a location/place card with decorative topographic map pattern,
 * optional image, and map link.
 */
export const LocationBlock = memo(function LocationBlock({ block }: LocationBlockProps) {
  if (!block.name) return null;

  const mapUrl = block.mapUrl ??
    (block.coordinates
      ? `https://www.google.com/maps?q=${block.coordinates.lat},${block.coordinates.lng}`
      : block.address
        ? `https://www.google.com/maps/search/${encodeURIComponent(block.address)}`
        : null);

  const hasImage = !!block.imageUrl;

  return (
    <BlockWrapper
      blockId={block.blockId}
      label={`Location: ${block.name}`}
      variant="transparent"
    >
      <div className="block-label-minimal">
        <MapPin className="h-3 w-3" aria-hidden="true" />
        <span>Location</span>
      </div>
      <div className="relative rounded-lg overflow-hidden location-compass">
        {/* Layout: content left ~70%, decorative right ~30% */}
        <div className="flex min-h-[100px]">
          {/* Content area */}
          <div className="relative flex-1 py-2 space-y-2 z-10">
            <div className="flex items-start gap-2">
              <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mt-0.5" aria-hidden="true">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <h4 className="font-medium text-sm">{block.name}</h4>
                {block.address && (
                  <p className="text-xs text-muted-foreground mt-0.5">{block.address}</p>
                )}
                {block.coordinates && (
                  <p className="text-[10px] font-mono text-muted-foreground/50 mt-0.5">
                    {block.coordinates.lat.toFixed(4)}, {block.coordinates.lng.toFixed(4)}
                  </p>
                )}
              </div>
            </div>

            {block.description && (
              <p className="text-sm text-muted-foreground">{block.description}</p>
            )}

            {mapUrl && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'inline-flex items-center gap-1.5 text-xs font-medium text-primary',
                  'px-2.5 py-1.5 rounded-md bg-primary/[0.06] hover:bg-primary/[0.12]',
                  'transition-all hover-lift',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
                )}
              >
                <MapPin className="h-3 w-3" aria-hidden="true" />
                <span>{BLOCK_LABELS.viewOnMap}</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            )}
          </div>

          {/* Right decorative area: image or map pattern */}
          {hasImage ? (
            <div className="relative w-[30%] shrink-0 hidden sm:block">
              <img
                src={block.imageUrl}
                alt={block.name}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
            </div>
          ) : (
            <div className="location-map-bg" aria-hidden="true" />
          )}
        </div>
      </div>
    </BlockWrapper>
  );
});
