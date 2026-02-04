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
 * Renders a location/place card with optional map link and image.
 */
export const LocationBlock = memo(function LocationBlock({ block }: LocationBlockProps) {
  if (!block.name) return null;

  const mapUrl = block.mapUrl ??
    (block.coordinates
      ? `https://www.google.com/maps?q=${block.coordinates.lat},${block.coordinates.lng}`
      : block.address
        ? `https://www.google.com/maps/search/${encodeURIComponent(block.address)}`
        : null);

  return (
    <BlockWrapper
      blockId={block.blockId}
      label={`Location: ${block.name}`}
    >
      <div className="rounded-lg border border-border/50 overflow-hidden bg-card">
        {block.imageUrl && (
          <div className="aspect-video w-full overflow-hidden">
            <img
              src={block.imageUrl}
              alt={block.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        <div className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-[var(--category-accent,#10B981)]" aria-hidden="true" />
              <div>
                <h4 className="font-medium text-sm">{block.name}</h4>
                {block.address && (
                  <p className="text-xs text-muted-foreground mt-0.5">{block.address}</p>
                )}
              </div>
            </div>

            {mapUrl && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex items-center gap-1 text-xs text-primary hover:underline shrink-0',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded'
                )}
              >
                <span>{BLOCK_LABELS.viewOnMap}</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            )}
          </div>

          {block.description && (
            <p className="text-sm text-muted-foreground">{block.description}</p>
          )}
        </div>
      </div>
    </BlockWrapper>
  );
});
