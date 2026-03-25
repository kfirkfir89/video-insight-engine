import { useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { VideoGrid, type FolderContext } from "@/components/videos/VideoGrid";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useAllVideos, useVideos } from "@/hooks/use-videos";
import { useFolders } from "@/hooks/use-folders";
import { useUIStore } from "@/stores/ui-store";
import { buildBreadcrumbPath, getSubfolders } from "@/features/sidebar/lib/folder-utils";
import { FolderOpen } from "lucide-react";

export function BoardPage() {
  const selectedFolderId = useUIStore((s) => s.selectedFolderId);
  const setSelectedFolder = useUIStore((s) => s.setSelectedFolder);

  // Fetch all videos and folders for the summarized section
  const { data: allVideosData, isLoading: allVideosLoading } = useAllVideos();
  const { data: filteredVideosData, isLoading: filteredLoading } = useVideos(
    selectedFolderId ?? undefined
  );
  const { data: foldersData, isLoading: foldersLoading } = useFolders();

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

  // Build folder context for VideoGrid
  const folderContext: FolderContext = useMemo(() => ({
    currentFolderId: selectedFolderId,
    subfolders,
    allFolders: foldersData?.folders || [],
    allVideos: allVideosData?.videos || [],
  }), [selectedFolderId, subfolders, foldersData?.folders, allVideosData?.videos]);

  return (
    <Layout showSidebar>
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
    </Layout>
  );
}
