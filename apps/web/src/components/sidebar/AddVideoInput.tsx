import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2, Link2, Folder } from "lucide-react";
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
import { FolderTreeSelect } from "./FolderTreeSelect";
import { useUIStore } from "@/stores/ui-store";
import { useAddVideo } from "@/hooks/use-videos";
import { useFolders } from "@/hooks/use-folders";
import { getFolderColorStyle } from "@/lib/style-utils";
import { cn } from "@/lib/utils";

// Sentinel value to indicate "use sidebar selection" instead of explicit user choice
const USE_SIDEBAR_SELECTION = Symbol.for("use-sidebar-selection");
type FolderSelection = string | null | typeof USE_SIDEBAR_SELECTION;

export function AddVideoInput() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const selectedFolderId = useUIStore((s) => s.selectedFolderId);
  const activeSection = useUIStore((s) => s.activeSection);
  const addVideo = useAddVideo();
  const navigate = useNavigate();

  // Fetch folders for the selector
  const { data: foldersData } = useFolders("summarized");

  // Track user's explicit folder selection
  // USE_SIDEBAR_SELECTION means "use sidebar selection", string|null means explicit choice
  const [userSelection, setUserSelection] = useState<FolderSelection>(USE_SIDEBAR_SELECTION);

  // Derive target folder: user selection takes precedence over sidebar
  const targetFolderId = userSelection === USE_SIDEBAR_SELECTION
    ? selectedFolderId
    : userSelection;

  const handleFolderSelect = (folderId: string | null) => {
    setUserSelection(folderId);
    setDropdownOpen(false);
  };

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
      const result = await addVideo.mutateAsync({ url: url.trim(), folderId: targetFolderId });
      setUrl("");
      // Reset folder selection tracking so next add follows sidebar selection again
      setUserSelection(USE_SIDEBAR_SELECTION);

      // Navigate to video detail page to show streaming progress
      if (result?.video?.id) {
        navigate(`/video/${result.video.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add video");
    }
  };

  const folders = foldersData?.folders || [];
  const selectedFolder = folders.find((f) => f.id === targetFolderId);
  const folderTooltip = selectedFolder?.name || "No folder selected";

  return (
    <form onSubmit={handleSubmit} className="p-3">
      <div className="relative flex items-center">
        {/* Link icon - decorative */}
        <Link2 className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />

        {/* URL input */}
        <Input
          placeholder="Paste YouTube URL..."
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError(null);
          }}
          className="h-9 pl-9 pr-[70px] text-sm"
          disabled={addVideo.isPending}
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
                      disabled={addVideo.isPending}
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
            disabled={!url.trim() || addVideo.isPending}
          >
            {addVideo.isPending ? (
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
  );
}
