import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2, Folder, Video, ListVideo } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FolderTreeSelect } from "./FolderTreeSelect";
import { PlaylistPreview } from "@/components/playlists/PlaylistPreview";
import { useUIStore } from "@/stores/ui-store";
import { useAddVideo } from "@/hooks/use-videos";
import { usePlaylistPreview, usePlaylistImport } from "@/hooks/use-playlists";
import { useFolders } from "@/hooks/use-folders";
import { getFolderColorStyle } from "@/lib/style-utils";
import { cn } from "@/lib/utils";
import { hasVideoId, hasPlaylistId, isPlaylistPage } from "@/lib/youtube-utils";
import type { PlaylistPreview as PlaylistPreviewType } from "@/api/playlists";

type Mode = "video" | "playlist";

// Sentinel value to indicate "use sidebar selection" instead of explicit user choice
const USE_SIDEBAR_SELECTION = Symbol.for("use-sidebar-selection");
type FolderSelection = string | null | typeof USE_SIDEBAR_SELECTION;

export function AddVideoInput() {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<Mode>("video");
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [playlistPreview, setPlaylistPreview] = useState<PlaylistPreviewType | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  const selectedFolderId = useUIStore((s) => s.selectedFolderId);
  const activeSection = useUIStore((s) => s.activeSection);
  const addVideo = useAddVideo();
  const previewMutation = usePlaylistPreview();
  const importMutation = usePlaylistImport();
  const navigate = useNavigate();

  // Fetch folders for the selector
  const { data: foldersData } = useFolders("summarized");

  // Track user's explicit folder selection
  const [userSelection, setUserSelection] = useState<FolderSelection>(USE_SIDEBAR_SELECTION);

  // Derive target folder: user selection takes precedence over sidebar
  const targetFolderId = userSelection === USE_SIDEBAR_SELECTION
    ? selectedFolderId
    : userSelection;

  const handleFolderSelect = (folderId: string | null) => {
    setUserSelection(folderId);
    setDropdownOpen(false);
  };

  const toggleMode = () => {
    setMode(mode === "video" ? "playlist" : "video");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    // Only allow adding videos in summarized section
    if (activeSection !== "summarized") {
      setError("Switch to Summaries to add videos");
      return;
    }

    const trimmedUrl = url.trim();

    if (mode === "video") {
      // Validate URL has video ID
      if (!hasVideoId(trimmedUrl)) {
        if (hasPlaylistId(trimmedUrl)) {
          setError("This is a playlist URL. Click the toggle to switch to Playlist mode.");
        } else {
          setError("No video ID found in URL");
        }
        return;
      }

      try {
        setError(null);
        // For videos: only pass folderId if user explicitly selected one (not sidebar default)
        // This ensures videos go to root by default, matching expected behavior
        const explicitFolderId = userSelection !== USE_SIDEBAR_SELECTION ? userSelection : undefined;
        const result = await addVideo.mutateAsync({ url: trimmedUrl, folderId: explicitFolderId ?? undefined });
        setUrl("");
        setUserSelection(USE_SIDEBAR_SELECTION);

        if (result?.video?.id) {
          navigate(`/video/${result.video.id}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add video");
      }
    } else {
      // Playlist mode - validate URL has playlist ID
      if (!hasPlaylistId(trimmedUrl)) {
        if (hasVideoId(trimmedUrl) && !isPlaylistPage(trimmedUrl)) {
          setError("This is a video URL. Click the toggle to switch to Video mode.");
        } else {
          setError("No playlist ID found in URL");
        }
        return;
      }

      // Fetch playlist preview
      try {
        setError(null);
        const preview = await previewMutation.mutateAsync({ url: trimmedUrl });
        setPlaylistPreview(preview);
        setShowPreviewDialog(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load playlist");
      }
    }
  };

  const handleImportPlaylist = async () => {
    if (!playlistPreview) return;

    try {
      // For playlists: only pass folderId if user explicitly selected one (not sidebar default)
      // This ensures playlists create their own folder by default
      const explicitFolderId = userSelection !== USE_SIDEBAR_SELECTION ? userSelection : undefined;
      await importMutation.mutateAsync({ url: url.trim(), folderId: explicitFolderId ?? undefined });
      setShowPreviewDialog(false);
      setPlaylistPreview(null);
      setUrl("");
      setUserSelection(USE_SIDEBAR_SELECTION);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import playlist");
    }
  };

  const folders = foldersData?.folders || [];
  const selectedFolder = folders.find((f) => f.id === targetFolderId);
  const folderTooltip = selectedFolder?.name || "No folder selected";

  const isLoading = addVideo.isPending || previewMutation.isPending || importMutation.isPending;

  return (
    <>
      <form onSubmit={handleSubmit} className="p-3">
        <div className="relative flex items-center">
          {/* Mode toggle button */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute left-1 h-7 w-7 z-10"
                  onClick={toggleMode}
                  disabled={isLoading}
                >
                  {mode === "video" ? (
                    <Video className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ListVideo className="h-4 w-4 text-primary" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {mode === "video" ? "Single Video mode (click to switch to Playlist)" : "Playlist mode (click to switch to Video)"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* URL input */}
          <Input
            placeholder={mode === "video" ? "Paste YouTube URL..." : "Paste playlist URL..."}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError(null);
            }}
            className="h-9 pl-9 pr-[70px] text-sm"
            disabled={isLoading}
          />

          {/* Right side: folder + add buttons */}
          <div className="absolute right-1 flex items-center gap-0.5">
            {/* Folder dropdown trigger with tooltip */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="group h-7 w-7 hover:bg-accent hover:scale-110 transition-all"
                        type="button"
                        disabled={isLoading}
                      >
                        <Folder
                          className={cn(
                            "h-4 w-4 transition-colors",
                            selectedFolder
                              ? "group-hover:opacity-80"
                              : "text-muted-foreground group-hover:text-foreground"
                          )}
                          style={selectedFolder ? getFolderColorStyle(selectedFolder.color) : undefined}
                        />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {folderTooltip}
                  </TooltipContent>
                  <DropdownMenuContent align="end" className="w-56 max-h-60 overflow-y-auto">
                    <FolderTreeSelect
                      folders={folders}
                      currentFolderId={null}
                      onSelect={handleFolderSelect}
                      showRemoveOption={true}
                      removeLabel="No folder"
                    />
                  </DropdownMenuContent>
                </DropdownMenu>
              </Tooltip>
            </TooltipProvider>

            {/* Add button */}
            <Button
              type="submit"
              size="icon"
              className="h-7 w-7"
              disabled={!url.trim() || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Error message */}
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </form>

      {/* Playlist Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Playlist</DialogTitle>
          </DialogHeader>
          {playlistPreview && (
            <PlaylistPreview
              playlist={playlistPreview}
              onImport={handleImportPlaylist}
              isImporting={importMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
