import { Layout } from "@/components/layout/Layout";
import { VideoGrid } from "@/components/videos/VideoGrid";
import { useAllVideos, useVideos } from "@/hooks/use-videos";
import { useFolders } from "@/hooks/use-folders";
import { useUIStore } from "@/stores/ui-store";
import { Brain, FolderOpen } from "lucide-react";

export function DashboardPage() {
  // UI state from store (controlled by sidebar)
  const activeSection = useUIStore((s) => s.activeSection);
  const selectedFolderId = useUIStore((s) => s.selectedFolderId);

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

  // Get folder name for header when a specific folder is selected
  const selectedFolder = selectedFolderId
    ? foldersData?.folders.find((f) => f.id === selectedFolderId)
    : null;

  return (
    <Layout showSidebar>
      {activeSection === "summarized" ? (
        <div>
          {/* Header */}
          <div className="mb-6 flex items-center gap-3">
            <FolderOpen className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-2xl font-bold">
              {selectedFolder ? selectedFolder.name : "All Videos"}
            </h1>
          </div>

          {/* Video Grid - grouped by folder when showing all */}
          <VideoGrid
            videos={videos}
            folders={foldersData?.folders || []}
            isLoading={isLoading}
            groupByFolder={isShowingAll}
          />
        </div>
      ) : (
        <div>
          {/* Header */}
          <div className="mb-6 flex items-center gap-3">
            <Brain className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-2xl font-bold">
              {selectedFolderId ? "Memorized Items" : "All Memorized"}
            </h1>
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
