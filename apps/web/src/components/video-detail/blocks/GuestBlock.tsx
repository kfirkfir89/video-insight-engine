import { memo } from 'react';
import { User, Users, ExternalLink, Twitter, Github, Linkedin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sanitizeUrl } from '@/lib/url-utils';
import { BlockWrapper } from './BlockWrapper';
import { ConceptHighlighter } from '../ConceptHighlighter';
import type { GuestBlock as GuestBlockType } from '@vie/types';
import { BLOCK_LABELS } from '@/lib/block-labels';

interface GuestBlockProps {
  block: GuestBlockType;
}

const SOCIAL_ICONS: Record<string, typeof Twitter> = {
  twitter: Twitter,
  github: Github,
  linkedin: Linkedin,
};

/**
 * Renders podcast/interview guest bio cards.
 */
export const GuestBlock = memo(function GuestBlock({ block }: GuestBlockProps) {
  const guests = block.guests ?? [];

  if (guests.length === 0) return null;

  return (
    <BlockWrapper
      blockId={block.blockId}
      label={BLOCK_LABELS.guests}
      variant="transparent"
    >
      <div className="block-label-minimal">
        <Users className="h-3 w-3" aria-hidden="true" />
        <span>{BLOCK_LABELS.guests}</span>
      </div>
      <div className="stagger-children">
        {guests.map((guest, index) => (
          <div key={index}>
            <div className="flex gap-4 py-3">
              {/* Avatar */}
              {guest.imageUrl ? (
                <img
                  src={guest.imageUrl}
                  alt={guest.name}
                  className="w-16 h-16 rounded-full object-cover shrink-0 ring-2 ring-border avatar-glow"
                  loading="lazy"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center shrink-0 ring-2 ring-border/20 avatar-glow">
                  <User className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <h4 className="font-medium text-sm">{guest.name}</h4>
                  {guest.title && (
                    <p className="text-xs text-muted-foreground">{guest.title}</p>
                  )}
                </div>

                {guest.bio && (
                  <p className="text-xs text-muted-foreground/80 line-clamp-2"><ConceptHighlighter text={guest.bio} /></p>
                )}

                {/* Social links */}
                {guest.socialLinks && guest.socialLinks.length > 0 && (
                  <div className="flex items-center gap-2">
                    {guest.socialLinks.map((link, linkIndex) => {
                      const safeUrl = sanitizeUrl(link.url);
                      if (!safeUrl) return null;
                      const IconComponent = SOCIAL_ICONS[link.platform.toLowerCase()] ?? ExternalLink;
                      return (
                        <a
                          key={linkIndex}
                          href={safeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            'text-muted-foreground/60 hover:text-primary transition-colors',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded'
                          )}
                          aria-label={`${guest.name} on ${link.platform}`}
                        >
                          <IconComponent className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            {index < guests.length - 1 && (
              <div className="fade-divider" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
    </BlockWrapper>
  );
});
