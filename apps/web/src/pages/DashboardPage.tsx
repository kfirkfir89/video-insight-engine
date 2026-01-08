import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { VideoGrid } from "@/components/videos/VideoGrid";
import { AddVideoDialog } from "@/components/videos/AddVideoDialog";
import { Button } from "@/components/ui/button";
import { useVideos, useAddVideo } from "@/hooks/use-videos";
import { useUIStore } from "@/stores/ui-store";
import { Plus, FolderOpen, Brain } from "lucide-react";

type Tab = "summarized" | "memorized";

export function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("summarized");

  // UI state
  const addVideoDialogOpen = useUIStore((s) => s.addVideoDialogOpen);
  const openAddVideoDialog = useUIStore((s) => s.openAddVideoDialog);
  const closeAddVideoDialog = useUIStore((s) => s.closeAddVideoDialog);

  // Remote state
  const { data: videosData, isLoading } = useVideos();
  const addVideo = useAddVideo();

  const handleAddVideo = async (url: string) => {
    await addVideo.mutateAsync(url);
    closeAddVideoDialog();
  };

  return (
    <Layout>
      {/* Tabs */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={activeTab === "summarized" ? "default" : "outline"}
            onClick={() => setActiveTab("summarized")}
          >
            <FolderOpen size={16} className="mr-2" />
            Summarized
          </Button>
          <Button
            variant={activeTab === "memorized" ? "default" : "outline"}
            onClick={() => setActiveTab("memorized")}
          >
            <Brain size={16} className="mr-2" />
            Memorized
          </Button>
        </div>

        {activeTab === "summarized" && (
          <Button onClick={openAddVideoDialog}>
            <Plus size={16} className="mr-2" />
            Add Video
          </Button>
        )}
      </div>

      {/* Content */}
      {activeTab === "summarized" ? (
        <VideoGrid videos={videosData?.videos || []} isLoading={isLoading} />
      ) : (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Brain size={48} className="mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium">No memorized items yet</h3>
          <p className="text-muted-foreground">
            Memorize sections and concepts from your videos to build your
            knowledge base
          </p>
        </div>
      )}

      {/* Add Video Dialog */}
      <AddVideoDialog
        open={addVideoDialogOpen}
        onClose={closeAddVideoDialog}
        onSubmit={handleAddVideo}
        isLoading={addVideo.isPending}
        error={addVideo.error?.message}
      />
    </Layout>
  );
}
