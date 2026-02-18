import { memo } from "react";
import { cn } from "@/lib/utils";

interface VideoTagsProps {
  tags: string[];
  className?: string;
}

// Max length for tag display (prevents layout issues from extremely long tags)
const MAX_TAG_LENGTH = 50;

/**
 * Sanitize a tag for safe display.
 * Removes potentially problematic characters and limits length.
 */
function sanitizeTag(tag: string): string {
  // Remove angle brackets to prevent any XSS issues (even though React escapes)
  // Trim whitespace and limit length
  return tag
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, MAX_TAG_LENGTH);
}

/**
 * Minimal tag display — plain #text in muted color, no pills or backgrounds.
 * Sanitizes tags to prevent layout issues from malformed data.
 */
export const VideoTags = memo(function VideoTags({ tags, className }: VideoTagsProps) {
  // Render nothing if no tags
  if (!tags || tags.length === 0) {
    return null;
  }

  return (
    <div
      data-slot="video-tags"
      className={cn("flex items-center flex-wrap gap-x-2 gap-y-1", className)}
    >
      {tags.map((tag, index) => {
        const sanitized = sanitizeTag(tag);
        // Skip empty tags after sanitization
        if (!sanitized) return null;

        return (
          <span
            key={`${sanitized}-${index}`}
            className="text-xs text-muted-foreground/70 max-w-[200px] truncate"
            title={tag.length > 25 ? tag : undefined}
          >
            #{sanitized}
          </span>
        );
      })}
    </div>
  );
});
