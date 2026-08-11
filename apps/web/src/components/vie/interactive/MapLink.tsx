import { memo } from 'react';
import { MapPin, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MapLinkProps {
  name: string;
  query?: string;
  className?: string;
}

/**
 * Clickable map link. Pure CSS underline draw + pin lift on hover.
 */
export const MapLink = memo(function MapLink({ name, query, className }: MapLinkProps) {
  const searchQuery = query || name;
  const href = `https://maps.google.com/?q=${encodeURIComponent(searchQuery)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group inline-flex items-center gap-1.5 text-[0.8125rem] font-medium leading-snug text-primary',
        className,
      )}
      aria-label={`View ${name} on Google Maps`}
    >
      <MapPin
        className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-[var(--ease-out-expo)] group-hover:-translate-y-0.5"
        aria-hidden="true"
      />
      <span className="relative">
        {name}
        <span
          aria-hidden="true"
          className="absolute start-0 bottom-[-2px] end-0 h-[1.5px] bg-primary origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-[var(--ease-out-expo)]"
        />
      </span>
      <ExternalLink
        className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity duration-200"
        aria-hidden="true"
      />
    </a>
  );
});
