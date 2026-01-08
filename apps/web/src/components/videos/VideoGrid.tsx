import { Link } from "react-router-dom";
import type { Video } from "@/types";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle, AlertCircle, Clock } from "lucide-react";

interface VideoGridProps {
  videos: Video[];
  isLoading: boolean;
}

export function VideoGrid({ videos, isLoading }: VideoGridProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <h3 className="text-lg font-medium">No videos yet</h3>
        <p className="text-muted-foreground">
          Add your first YouTube video to get started
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}

function VideoCard({ video }: { video: Video }) {
  const statusIcon = {
    pending: <Clock className="text-yellow-500" size={16} />,
    processing: <Loader2 className="animate-spin text-blue-500" size={16} />,
    completed: <CheckCircle className="text-green-500" size={16} />,
    failed: <AlertCircle className="text-red-500" size={16} />,
  };

  return (
    <Link to={`/video/${video.id}`}>
      <Card className="overflow-hidden transition-shadow hover:shadow-md">
        {/* Thumbnail */}
        <div className="aspect-video bg-muted">
          {video.thumbnailUrl ? (
            <img
              src={video.thumbnailUrl}
              alt={video.title || "Video thumbnail"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl">
              Video
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <div className="mb-2 flex items-center gap-2">
            {statusIcon[video.status]}
            <span className="text-xs capitalize text-muted-foreground">
              {video.status}
            </span>
          </div>
          <h3 className="line-clamp-2 font-medium">
            {video.title || "Loading..."}
          </h3>
          {video.channel && (
            <p className="mt-1 text-sm text-muted-foreground">
              {video.channel}
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}
