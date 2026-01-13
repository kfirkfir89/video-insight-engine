/**
 * ResourcesPanel - Displays extracted resources from video description.
 *
 * Shows links, resources, related videos, and social links extracted
 * via Haiku-based description analysis.
 */

import { ExternalLink, Github, FileText, Book, Link2, Video, Twitter } from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeUrl } from "@/lib/url-utils";
import type {
  DescriptionAnalysis,
  DescriptionLink,
  Resource,
  RelatedVideo,
  SocialLink,
} from "@/hooks/use-summary-stream";

interface ResourcesPanelProps {
  analysis: DescriptionAnalysis | null;
  className?: string;
}

const linkTypeIcons: Record<string, React.ElementType> = {
  github: Github,
  documentation: FileText,
  article: FileText,
  tool: Link2,
  course: Book,
  other: ExternalLink,
};

const socialIcons: Record<string, React.ElementType> = {
  twitter: Twitter,
  discord: Link2,
  github: Github,
  linkedin: Link2,
  patreon: Link2,
  other: Link2,
};

export function ResourcesPanel({ analysis, className }: ResourcesPanelProps) {
  if (!analysis) {
    return null;
  }

  // Issue #5: Filter out unsafe URLs (XSS prevention)
  const safeLinks = analysis.links.filter((link: DescriptionLink) => sanitizeUrl(link.url));
  const safeResources = analysis.resources.filter((resource: Resource) => sanitizeUrl(resource.url));
  const safeRelatedVideos = analysis.relatedVideos.filter((video: RelatedVideo) => sanitizeUrl(video.url));
  const safeSocialLinks = analysis.socialLinks.filter((social: SocialLink) => sanitizeUrl(social.url));

  const hasLinks = safeLinks.length > 0;
  const hasResources = safeResources.length > 0;
  const hasRelatedVideos = safeRelatedVideos.length > 0;
  const hasSocialLinks = safeSocialLinks.length > 0;

  const hasContent = hasLinks || hasResources || hasRelatedVideos || hasSocialLinks;

  if (!hasContent) {
    return null;
  }

  return (
    <div className={cn("space-y-4", className)}>
      <h3 className="text-sm font-medium text-muted-foreground">Resources</h3>

      {/* Links */}
      {hasLinks && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Links
          </h4>
          <div className="space-y-1">
            {safeLinks.map((link: DescriptionLink, index: number) => {
              const Icon = linkTypeIcons[link.type] || ExternalLink;
              return (
                <a
                  key={`${link.url}-${index}`}
                  href={sanitizeUrl(link.url)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-md",
                    "text-sm text-foreground/80 hover:text-foreground",
                    "hover:bg-accent transition-colors group"
                  )}
                >
                  <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                  <span className="flex-1 truncate">{link.label || link.url}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {link.type}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Resources */}
      {hasResources && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Mentioned Resources
          </h4>
          <div className="space-y-1">
            {safeResources.map((resource: Resource, index: number) => (
              <a
                key={`${resource.url}-${index}`}
                href={sanitizeUrl(resource.url)!}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md",
                  "text-sm text-foreground/80 hover:text-foreground",
                  "hover:bg-accent transition-colors"
                )}
              >
                <Book className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{resource.name}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Related Videos */}
      {hasRelatedVideos && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Related Videos
          </h4>
          <div className="space-y-1">
            {safeRelatedVideos.map((video: RelatedVideo, index: number) => (
              <a
                key={`${video.url}-${index}`}
                href={sanitizeUrl(video.url)!}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md",
                  "text-sm text-foreground/80 hover:text-foreground",
                  "hover:bg-accent transition-colors"
                )}
              >
                <Video className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{video.title || "Related Video"}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Social Links */}
      {hasSocialLinks && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Follow Creator
          </h4>
          <div className="flex flex-wrap gap-2">
            {safeSocialLinks.map((social: SocialLink, index: number) => {
              const Icon = socialIcons[social.platform] || Link2;
              return (
                <a
                  key={`${social.url}-${index}`}
                  href={sanitizeUrl(social.url)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-1 rounded-md",
                    "text-xs text-muted-foreground hover:text-foreground",
                    "bg-muted hover:bg-accent transition-colors capitalize"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {social.platform}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ResourcesPanel;
