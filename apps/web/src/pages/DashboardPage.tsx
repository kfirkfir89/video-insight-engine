import { useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { VideoGrid, type FolderContext } from "@/components/videos/VideoGrid";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useAllVideos, useVideos } from "@/hooks/use-videos";
import { useFolders } from "@/hooks/use-folders";
import { useUIStore } from "@/stores/ui-store";
import { buildBreadcrumbPath, getSubfolders } from "@/lib/folder-utils";
import { Brain, FolderOpen } from "lucide-react";

export function DashboardPage() {
  // UI state from store (controlled by sidebar)
  const activeSection = useUIStore((s) => s.activeSection);
  const selectedFolderId = useUIStore((s) => s.selectedFolderId);
  const setSelectedFolder = useUIStore((s) => s.setSelectedFolder);

  // Fetch all videos and folders for the summarized section
  const { data: allVideosData, isLoading: allVideosLoading } = useAllVideos();
  const { data: filteredVideosData, isLoading: filteredLoading } = useVideos(
    selectedFolderId ?? undefined
  );
  const { data: foldersData, isLoading: foldersLoading } = useFolders("summarized");

  // Determine which videos to show
  const isShowingAll = selectedFolderId === null;
  const videos = isShowingAll
    ? allVideosData?.videos || []
    : filteredVideosData?.videos || [];
  const isLoading = isShowingAll
    ? allVideosLoading || foldersLoading
    : filteredLoading;

  // Get folder for breadcrumb when a specific folder is selected
  const selectedFolder = selectedFolderId
    ? foldersData?.folders.find((f) => f.id === selectedFolderId)
    : null;

  // Build breadcrumb items
  const breadcrumbItems = buildBreadcrumbPath(
    selectedFolder ?? null,
    foldersData?.folders || []
  );

  // Get subfolders of the current folder
  const subfolders = getSubfolders(
    selectedFolderId,
    foldersData?.folders || []
  );

  // Build folder context for VideoGrid (memoized to avoid unnecessary re-renders)
  const folderContext: FolderContext = useMemo(() => ({
    currentFolderId: selectedFolderId,
    subfolders,
    allFolders: foldersData?.folders || [],
    allVideos: allVideosData?.videos || [],
  }), [selectedFolderId, subfolders, foldersData?.folders, allVideosData?.videos]);

  return (
    <Layout showSidebar>
      {activeSection === "summarized" ? (
        <div className="p-4 md:p-6">
          {/* Header with Breadcrumb */}
          <div className="mb-6 flex items-center gap-3">
            <FolderOpen className="h-6 w-6 text-muted-foreground shrink-0" />
            <Breadcrumb
              items={breadcrumbItems}
              onNavigate={setSelectedFolder}
            />
          </div>

          {/* Video Grid - grouped by folder when showing all, with subfolder support */}
          <VideoGrid
            videos={videos}
            isLoading={isLoading}
            groupByFolder={isShowingAll}
            folderContext={folderContext}
          />
        </div>
      ) : (
        <div className="p-4 md:p-6">
          {/* Header with Breadcrumb for Memorized */}
          <div className="mb-6 flex items-center gap-3">
            <Brain className="h-6 w-6 text-muted-foreground shrink-0" />
            <Breadcrumb
              items={buildBreadcrumbPath(
                selectedFolder ?? null,
                foldersData?.folders || [],
                "All Memorized"
              )}
              onNavigate={setSelectedFolder}
            />
          </div>

          {/* Placeholder for Memorized content */}
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <Brain size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium">No memorized items yet</h3>
            <p className="text-muted-foreground">
              Memorize sections and concepts from your videos to build your
              knowledge base
            </p>
          </div>
        </div>
      )}
    </Layout>
  );
}
