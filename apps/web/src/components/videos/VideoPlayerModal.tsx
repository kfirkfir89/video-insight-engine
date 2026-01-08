import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Video } from "@/types";

interface VideoPlayerModalProps {
  video: Video | null;
  open: boolean;
  onClose: () => void;
}

export function VideoPlayerModal({ video, open, onClose }: VideoPlayerModalProps) {
  if (!video || !video.youtubeId) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden">
        <DialogTitle className="sr-only">{video.title}</DialogTitle>
        <div className="aspect-video w-full bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=1`}
            title={video.title || "Video"}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="p-4">
          <h3 className="font-semibold line-clamp-1">{video.title}</h3>
          {video.channel && (
            <p className="text-sm text-muted-foreground">{video.channel}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
