import { memo, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { Folder as FolderIcon, Play, Sparkles, Command, FileVideo, GraduationCap, ChefHat, Dumbbell, Code2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { getDomainGradient } from "@vie/shared/config";
import { FolderCard } from "./FolderCard";
import { VideoCard } from "./VideoCard";
import { useUIStore } from "@/stores/ui-store";
import { getFolderColorStyle } from "@/features/sidebar/lib/style-utils";
import type { Video, Folder } from "@/types";

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

/** Ambient starter tiles rendered below the library-empty card. Each tile
 *  previews a different content domain using the canonical domain gradient,
 *  so a first-time user sees the chromatic range of the product before they
 *  paste a single URL. Click routes to /generate for them to drop a real link. */
const STARTER_TILES = [
  { tag: "learning" as const, icon: GraduationCap, title: "A lecture", subtitle: "Get chapters, key points, quiz" },
  { tag: "food" as const, icon: ChefHat, title: "A recipe", subtitle: "Get ingredients and steps" },
  { tag: "fitness" as const, icon: Dumbbell, title: "A workout", subtitle: "Get exercises and timers" },
  { tag: "tech" as const, icon: Code2, title: "A code tutorial", subtitle: "Get snippets and patterns" },
] as const;

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

/** Skeleton card mirroring VideoCard's layout: thumbnail, status row, title, channel.
 *  Keeps CLS near-zero by preserving the same aspect-ratio and padding the real card uses. */
function VideoCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <Skeleton className="h-2 w-2 shrink-0 rounded-full" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="ms-auto h-3 w-12" />
        </div>
        <Skeleton className="h-4 w-[90%]" />
        <Skeleton className="mt-2 h-3 w-1/2" />
      </div>
    </div>
  );
}

const SKELETON_CARD_KEYS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"] as const;

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
      <div
        className="auto-grid"
        role="status"
        aria-live="polite"
        aria-label="Loading your collection"
      >
        {SKELETON_CARD_KEYS.map((k) => (
          <VideoCardSkeleton key={k} />
        ))}
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
      <div className="mx-auto max-w-3xl stack-xl">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-dashed border-border/60 p-10 text-start stack-lg">
          <FileVideo
            className="h-14 w-14 shrink-0 text-muted-foreground/60"
            aria-hidden="true"
            strokeWidth={1.5}
          />
          <div className="stack-xs">
            <p className="type-eyebrow text-[0.6875rem] font-mono uppercase tracking-[0.18em] text-muted-foreground/80">
              <span className="inline-block h-1 w-1 rounded-full bg-primary align-middle me-2" />
              {currentFolderId ? "Folder · empty" : "Library · empty"}
            </p>
            <h3 className="type-h3 text-balance">
              {currentFolderId ? "This folder is empty" : "Your library is empty"}
            </h3>
            <p className="type-caption text-pretty">
              {currentFolderId ? folderCopy : rootCopy}
            </p>
          </div>
          {!currentFolderId && (
            <div className="stack-sm">
              <Button asChild size="sm" className="gap-1.5 px-5 py-2 self-start">
                <Link to="/generate">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Create your first summary
                </Link>
              </Button>
              {/* Keyboard hint — desktop only. Mobile has no Cmd key. */}
              <p className="hidden md:flex items-center gap-1 text-xs text-muted-foreground/70 whitespace-nowrap">
                Tip: press
                <kbd className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">
                  <Command className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                  K
                </kbd>
                anywhere to jump around
              </p>
            </div>
          )}
        </div>

        {/* Ambient starter tiles — only on the root (not inside a folder).
            Preview the chromatic range so the canvas doesn't feel dead before
            the first video lands. */}
        {!currentFolderId && (
          <section aria-label="What you can turn into an app" className="stack-md">
            <p className="text-center type-eyebrow text-[0.6875rem] font-mono uppercase tracking-[0.18em] text-muted-foreground/70">
              <span className="inline-block h-1 w-1 rounded-full bg-primary align-middle me-2" />
              Try starting with…
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {STARTER_TILES.map(({ tag, icon: Icon, title, subtitle }) => (
                <Link
                  key={tag}
                  to="/generate"
                  className="group relative overflow-hidden rounded-xl border border-border/60 bg-card p-4 stack-sm hover:border-border hover:shadow-md transition-[box-shadow,border-color,transform] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
                >
                  {/* Domain spine — mirrors VideoCard's chromatic signal */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 start-0 w-[3px]"
                    style={{ backgroundImage: getDomainGradient(tag) }}
                  />
                  <Icon
                    className="h-5 w-5 shrink-0 text-muted-foreground/80 group-hover:text-foreground transition-colors"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <div className="stack-xs">
                    <h4 className="text-sm font-semibold text-foreground">{title}</h4>
                    <p className="text-xs text-muted-foreground leading-snug">
                      {subtitle}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
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
