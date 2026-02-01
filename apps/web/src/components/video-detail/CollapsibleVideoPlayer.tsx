import { forwardRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { YouTubePlayer, type YouTubePlayerRef } from "@/components/videos/YouTubePlayer";
import { cn } from "@/lib/utils";

interface CollapsibleVideoPlayerProps {
  youtubeId: string;
  className?: string;
}

/**
 * Collapsible video player that can expand/collapse between preview and full view.
 * Uses forwardRef to allow parent components to control the YouTube player.
 */
export const CollapsibleVideoPlayer = forwardRef<
  YouTubePlayerRef,
  CollapsibleVideoPlayerProps
>(function CollapsibleVideoPlayer({ youtubeId, className }, ref) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div data-slot="collapsible-video" className={cn("relative", className)}>
      <div
        className={cn(
          "relative overflow-hidden rounded-lg transition-all duration-300",
          isExpanded ? "aspect-video" : "h-[135px]"
        )}
      >
        <YouTubePlayer
          ref={ref}
          youtubeId={youtubeId}
          className="w-full h-full"
        />

        {/* Gradient overlay when collapsed */}
        {!isExpanded && (
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent pointer-events-none" />
        )}
      </div>

      {/* Expand/Collapse toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full mt-2 text-muted-foreground hover:text-foreground"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "Collapse video" : "Expand video"}
      >
        {isExpanded ? (
          <>
            <ChevronUp className="h-4 w-4 mr-1" />
            Collapse
          </>
        ) : (
          <>
            <ChevronDown className="h-4 w-4 mr-1" />
            Expand Video
          </>
        )}
      </Button>
    </div>
  );
});

CollapsibleVideoPlayer.displayName = "CollapsibleVideoPlayer";
