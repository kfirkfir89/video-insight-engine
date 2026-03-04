import { memo } from "react";
import { Link } from "react-router-dom";
import type { Video } from "@/types";
import { getOutputTypeConfig } from "@/lib/output-type-config";

interface BoardCardProps {
  video: Video;
}

export const BoardCard = memo(function BoardCard({ video }: BoardCardProps) {
  const outputType = video.outputType ?? "summary";
  const config = getOutputTypeConfig(outputType);

  const thumbnailUrl =
    video.thumbnailUrl ||
    (video.youtubeId ? `https://i.ytimg.com/vi/${video.youtubeId}/mqdefault.jpg` : null);

  return (
    <Link
      to={`/video/${video.id}`}
      className="group block rounded-xl overflow-hidden glass hover-lift transition-all"
    >
      {/* Gradient top bar */}
      <div className="h-1.5" style={{ background: config.gradient }} />

      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-muted">
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt={video.title || "Video thumbnail"}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <span className="absolute bottom-2 left-2 text-xl">{config.emoji}</span>
      </div>

      {/* Content */}
      <div className="p-3 space-y-1.5">
        <h3 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
          {video.title || "Untitled"}
        </h3>
        <p className="text-xs text-muted-foreground">
          {config.label}
        </p>
      </div>
    </Link>
  );
});
