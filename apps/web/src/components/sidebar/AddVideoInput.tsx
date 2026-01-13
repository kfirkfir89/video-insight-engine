import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/ui-store";
import { useAddVideo } from "@/hooks/use-videos";

export function AddVideoInput() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const selectedFolderId = useUIStore((s) => s.selectedFolderId);
  const activeSection = useUIStore((s) => s.activeSection);
  const addVideo = useAddVideo();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    // Only allow adding videos in summarized section
    if (activeSection !== "summarized") {
      setError("Switch to Summaries to add videos");
      return;
    }

    try {
      setError(null);
      const result = await addVideo.mutateAsync({ url: url.trim(), folderId: selectedFolderId });
      setUrl("");

      // Navigate to video detail page to show streaming progress
      if (result?.video?.id) {
        navigate(`/video/${result.video.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add video");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 space-y-2">
      <Input
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          if (error) setError(null);
        }}
        placeholder="Paste YouTube URL..."
        className="text-sm h-9"
        disabled={addVideo.isPending}
      />
      <Button
        type="submit"
        className="w-full h-9 cursor-pointer"
        disabled={addVideo.isPending || !url.trim()}
      >
        {addVideo.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Plus className="h-4 w-4 mr-2" />
        )}
        Add Video
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
