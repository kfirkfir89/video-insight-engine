import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, Loader2, PlayCircle } from "lucide-react";
import { formatDuration } from "@/lib/string-utils";
import type { PlaylistPreview as PlaylistPreviewType } from "@/api/playlists";

interface PlaylistPreviewProps {
  playlist: PlaylistPreviewType;
  onImport: () => void;
  isImporting: boolean;
}

export function PlaylistPreview({
  playlist,
  onImport,
  isImporting,
}: PlaylistPreviewProps) {
  const uncachedCount = playlist.totalVideos - playlist.cachedCount;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex gap-4">
        {playlist.thumbnailUrl && (
          <img
            src={playlist.thumbnailUrl}
            alt={playlist.title}
            className="h-20 w-32 rounded-md object-cover"
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg truncate">{playlist.title}</h3>
          {playlist.channel && (
            <p className="text-sm text-muted-foreground">{playlist.channel}</p>
          )}
          <div className="flex gap-2 mt-2">
            <Badge variant="secondary">
              <PlayCircle className="h-3 w-3 mr-1" />
              {playlist.totalVideos} videos
            </Badge>
            {playlist.cachedCount > 0 && (
              <Badge variant="outline" className="text-green-600 border-green-200">
                <Check className="h-3 w-3 mr-1" />
                {playlist.cachedCount} cached
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Video List */}
      <ScrollArea className="h-[200px] rounded-md border">
        <div className="p-2 space-y-1">
          {playlist.videos.map((video) => (
            <div
              key={video.videoId}
              className="flex items-center gap-3 p-2 rounded hover:bg-muted/50"
            >
              <span className="text-xs text-muted-foreground w-6 text-right">
                {video.position + 1}
              </span>
              {video.thumbnailUrl && (
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  className="h-9 w-16 rounded object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{video.title}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDuration(video.duration)}
                  {video.isCached && (
                    <Badge variant="outline" className="text-xs h-4 px-1">
                      <Check className="h-2 w-2 mr-0.5" />
                      cached
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Import Info & Button */}
      <div className="flex items-center justify-between pt-2 border-t">
        <div className="text-sm text-muted-foreground">
          {uncachedCount > 0 ? (
            <span>
              {uncachedCount} video{uncachedCount !== 1 ? "s" : ""} will be
              processed
            </span>
          ) : (
            <span className="text-green-600">All videos are cached!</span>
          )}
        </div>
        <Button onClick={onImport} disabled={isImporting}>
          {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isImporting ? "Importing..." : "Import Playlist"}
        </Button>
      </div>
    </div>
  );
}
