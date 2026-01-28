import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Video, ListVideo, AlertCircle } from "lucide-react";
import { PlaylistPreview } from "@/components/playlists/PlaylistPreview";
import { usePlaylistPreview, usePlaylistImport } from "@/hooks/use-playlists";
import { validateUrlForMode, type PlaylistMode } from "@/lib/youtube-utils";
import type { PlaylistPreview as PlaylistPreviewType } from "@/api/playlists";

type Mode = PlaylistMode;

interface AddVideoDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
  isLoading: boolean;
  error?: string;
}

export function AddVideoDialog({
  open,
  onClose,
  onSubmit,
  isLoading,
  error,
}: AddVideoDialogProps) {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<Mode>("video");
  const [playlistPreview, setPlaylistPreview] =
    useState<PlaylistPreviewType | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const previewMutation = usePlaylistPreview();
  const importMutation = usePlaylistImport();

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setPlaylistPreview(null);
    setValidationError(null);
    previewMutation.reset();
  };

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    setValidationError(null);
    setPlaylistPreview(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    // Validate URL for mode
    const validation = validateUrlForMode(trimmedUrl, mode);
    if (!validation.valid) {
      setValidationError(
        validation.suggestion
          ? `${validation.error}. ${validation.suggestion}`
          : validation.error ?? "Invalid URL"
      );
      return;
    }

    if (mode === "video") {
      // Single video - use existing flow
      onSubmit(trimmedUrl);
    } else {
      // Playlist - fetch preview first
      try {
        const preview = await previewMutation.mutateAsync({ url: trimmedUrl });
        setPlaylistPreview(preview);
      } catch (err) {
        setValidationError(
          err instanceof Error ? err.message : "Failed to load playlist"
        );
      }
    }
  };

  const handleImportPlaylist = async () => {
    if (!playlistPreview) return;

    try {
      await importMutation.mutateAsync({ url: url.trim() });
      handleClose();
    } catch (err) {
      setValidationError(
        err instanceof Error ? err.message : "Failed to import playlist"
      );
    }
  };

  const handleClose = () => {
    onClose();
    setUrl("");
    setMode("video");
    setPlaylistPreview(null);
    setValidationError(null);
    previewMutation.reset();
    importMutation.reset();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleClose();
    }
  };

  const displayError =
    validationError ||
    error ||
    (previewMutation.error instanceof Error
      ? previewMutation.error.message
      : null) ||
    (importMutation.error instanceof Error
      ? importMutation.error.message
      : null);

  const isSubmitting =
    isLoading || previewMutation.isPending || importMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Content</DialogTitle>
        </DialogHeader>

        {/* Mode Toggle */}
        <div className="flex gap-2 p-1 bg-muted rounded-lg">
          <Button
            type="button"
            variant={mode === "video" ? "default" : "ghost"}
            size="sm"
            className="flex-1"
            onClick={() => handleModeChange("video")}
          >
            <Video className="h-4 w-4 mr-2" />
            Single Video
          </Button>
          <Button
            type="button"
            variant={mode === "playlist" ? "default" : "ghost"}
            size="sm"
            className="flex-1"
            onClick={() => handleModeChange("playlist")}
          >
            <ListVideo className="h-4 w-4 mr-2" />
            Playlist
          </Button>
        </div>

        {/* Playlist Preview */}
        {playlistPreview ? (
          <PlaylistPreview
            playlist={playlistPreview}
            onImport={handleImportPlaylist}
            isImporting={importMutation.isPending}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {displayError && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{displayError}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="url">
                {mode === "video" ? "YouTube Video URL" : "YouTube Playlist URL"}
              </Label>
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder={
                  mode === "video"
                    ? "https://www.youtube.com/watch?v=..."
                    : "https://www.youtube.com/playlist?list=..."
                }
                required
              />
              <p className="text-xs text-muted-foreground">
                {mode === "video"
                  ? "Paste a YouTube video URL to summarize it"
                  : "Paste a YouTube playlist URL to import all videos"}
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isSubmitting
                  ? mode === "video"
                    ? "Adding..."
                    : "Loading..."
                  : mode === "video"
                    ? "Add Video"
                    : "Preview Playlist"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
