import { memo, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { Loader2, Folder as FolderIcon, Play, Sparkles } from "lucide-react";

/** Stable-per-session rotation of empty-state copy — returning users see variety
 *  without the message ever feeling jumpy within a session. */
const EMPTY_ROOT_VARIANTS: readonly string[] = [
  "Paste a YouTube URL to turn any video into an interactive study guide in seconds.",
  "Drop in a link — walkthroughs, recipes, tutorials, lectures. All become searchable.",
  "Add your first video. We'll break it down into summary, key points, and what to remember.",
];
const EMPTY_FOLDER_VARIANTS: readonly string[] = [
  "Drop a YouTube URL above to add videos, or create subfolders to organize.",
  "Fill this folder with videos — or nest subfolders to group them by topic.",
];

/** Deterministic-per-day variant pick. Fresh copy every day without jitter within a session. */
function pickStableVariant<T>(variants: readonly T[]): T {
  const daySeed = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return variants[daySeed % variants.length];
}
import { FolderCard } from "./FolderCard";
import { VideoCard } from "./VideoCard";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/ui-store";
import { getFolderColorStyle } from "@/features/sidebar/lib/style-utils";
import type { Video, Folder } from "@/types";

const EMPTY_FOLDERS: Folder[] = [];
const EMPTY_VIDEOS: Video[] = [];

/**
 * Context object for folder-related display options.
 * Groups related folder props into a single object for cleaner API.
 */
export interface FolderContext {
  /** Currently selected folder ID (null = root/all) */
  currentFolderId: string | null;
  /** Direct children folders of the current folder */
  subfolders: Folder[];
  /** All folders in the hierarchy (for grouping and navigation) */
  allFolders: Folder[];
  /** All videos (for counting in FolderCard) */
  allVideos: Video[];
}

interface VideoGridProps {
  /** Videos to display */
  videos: Video[];
  /** Loading state */
  isLoading: boolean;
  /** Group videos by folder (for "All Videos" view) */
  groupByFolder?: boolean;
  /** Folder context for navigation and display */
  folderContext?: FolderContext;
}

export const VideoGrid = memo(function VideoGrid({
  videos,
  isLoading,
  groupByFolder = false,
  folderContext,
}: VideoGridProps) {
  // Extract folder context with defaults
  const currentFolderId = folderContext?.currentFolderId ?? null;
  const subfolders = folderContext?.subfolders ?? EMPTY_FOLDERS;
  const folders = folderContext?.allFolders ?? EMPTY_FOLDERS;
  const allVideos = folderContext?.allVideos ?? EMPTY_VIDEOS;
  const setSelectedFolder = useUIStore((s) => s.setSelectedFolder);
  const setActiveSection = useUIStore((s) => s.setActiveSection);

  const handleFolderClick = useCallback(
    (folderId: string) => {
      setSelectedFolder(folderId);
      setActiveSection("summarized");
    },
    [setSelectedFolder, setActiveSection]
  );

  // Memoize grouping logic - must be called unconditionally to respect Rules of Hooks
  // Even if groupByFolder is false, we still compute this (but don't use it)
  const { sortedGroups, folderMap } = useMemo(() => {
    const folderMap = new Map(folders.map((f) => [f.id, f]));
    const grouped = new Map<string | null, Video[]>();

    // Initialize groups for all folders (even empty ones won't show)
    for (const video of videos) {
      const folderId = video.folderId;
      if (!grouped.has(folderId)) {
        grouped.set(folderId, []);
      }
      grouped.get(folderId)!.push(video);
    }

    // Sort folder groups: folders first (alphabetically), then unassigned at the end
    const sortedGroups = Array.from(grouped.entries()).sort((a, b) => {
      const [folderIdA] = a;
      const [folderIdB] = b;

      // Unassigned goes last
      if (folderIdA === null) return 1;
      if (folderIdB === null) return -1;

      // Sort by folder name
      const folderA = folderMap.get(folderIdA);
      const folderB = folderMap.get(folderIdB);
      return (folderA?.name || "").localeCompare(folderB?.name || "");
    });

    return { sortedGroups, folderMap };
  }, [videos, folders]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Loading your collection...</p>
      </div>
    );
  }

  // Check if we have any content (videos or subfolders)
  const hasContent = videos.length > 0 || subfolders.length > 0;

  if (!hasContent) {
    // Pick a stable variant per render cycle — fresh at reload, consistent during the session.
    const rootCopy = pickStableVariant(EMPTY_ROOT_VARIANTS);
    const folderCopy = pickStableVariant(EMPTY_FOLDER_VARIANTS);
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-dashed border-border/70 p-10 text-center stack-lg">
        <div className="icon-glow relative mx-auto w-14 h-14 flex items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="h-6 w-6 icon-float" aria-hidden="true" />
        </div>
        <div className="stack-xs">
          <h3 className="type-h3 text-balance">
            {currentFolderId ? "This folder is empty" : "Your library starts here"}
          </h3>
          <p className="type-caption text-pretty">
            {currentFolderId ? folderCopy : rootCopy}
          </p>
        </div>
        {!currentFolderId && (
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/generate">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Create your first VIE
              </Link>
            </Button>
            <p className="text-[11px] text-muted-foreground/70 self-center">
              Tip: press <kbd className="px-1 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">⌘K</kbd> anywhere to jump around
            </p>
          </div>
        )}
      </div>
    );
  }

  // If viewing a specific folder (not grouped mode), show subfolders + videos
  if (!groupByFolder && currentFolderId !== null) {
    return (
      <div className="stack-xl">
        {/* Subfolders section */}
        {subfolders.length > 0 && (
          <section className="stack-md">
            <h2 className="type-h3 flex items-center gap-2">
              <FolderIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Folders
              <span className="type-caption font-normal tabular-nums">
                ({subfolders.length})
              </span>
            </h2>
            <div className="auto-grid">
              {subfolders.map((folder) => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  allFolders={folders}
                  allVideos={allVideos}
                  onClick={handleFolderClick}
                />
              ))}
            </div>
          </section>
        )}

        {/* Videos section */}
        {videos.length > 0 && (
          <section className="stack-md">
            {subfolders.length > 0 && (
              <h2 className="type-h3 flex items-center gap-2">
                <Play className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                Videos
                <span className="type-caption font-normal tabular-nums">
                  ({videos.length})
                </span>
              </h2>
            )}
            <div className="auto-grid">
              {videos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  // If not grouping by folder (flat view without folder context)
  if (!groupByFolder) {
    return (
      <div className="auto-grid">
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>
    );
  }

  // Grouped by folder view - use pre-computed sortedGroups and folderMap
  return (
    <div className="stack-2xl">
      {sortedGroups.map(([folderId, folderVideos]) => {
        const folder = folderId ? folderMap.get(folderId) : null;
        const folderName = folder?.name || "Uncategorized";

        return (
          <section key={folderId || "uncategorized"} className="stack-md">
            {/* Folder Header - clickable to navigate to folder view */}
            <div
              className="flex items-center gap-2 cursor-pointer hover:bg-accent/20 -mx-2 px-2 py-2 rounded-lg transition-colors border-b border-border/20"
              onClick={() => {
                if (folder) {
                  setSelectedFolder(folder.id);
                  setActiveSection("summarized");
                }
              }}
            >
              <FolderIcon
                className="h-5 w-5 shrink-0"
                style={getFolderColorStyle(folder?.color)}
                aria-hidden="true"
              />
              <h2 className="type-h3">{folderName}</h2>
              <span className="type-caption tabular-nums">
                ({folderVideos.length})
              </span>
            </div>

            {/* Videos Grid */}
            <div className="auto-grid">
              {folderVideos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
});

// VideoCard component has been extracted to ./VideoCard.tsx
