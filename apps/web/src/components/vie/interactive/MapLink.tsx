import { memo } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, ExternalLink } from 'lucide-react';

interface MapLinkProps {
  name: string;
  /** Google Maps search query or coordinates */
  query?: string;
  className?: string;
}

/**
 * Clickable map link that opens Google Maps.
 */
export const MapLink = memo(function MapLink({
  name,
  query,
  className,
}: MapLinkProps) {
  const searchQuery = query || name;
  const href = `https://maps.google.com/?q=${encodeURIComponent(searchQuery)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1.5 text-xs text-primary hover:underline transition-colors',
        className,
      )}
      aria-label={`View ${name} on Google Maps`}
    >
      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{name}</span>
      <ExternalLink className="h-3 w-3 shrink-0 opacity-50" aria-hidden="true" />
    </a>
  );
});
