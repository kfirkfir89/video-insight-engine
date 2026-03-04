import { Layout } from "@/components/layout/Layout";
import { BoardGrid } from "@/components/board/BoardGrid";
import { useVideos } from "@/hooks/use-videos";
import { Loader2 } from "lucide-react";

export function BoardPage() {
  const { data, isLoading, error, refetch } = useVideos();
  const videos = data?.videos ?? [];

  return (
    <Layout>
      <div className="p-4 sm:p-6">
        <h1 className="text-2xl font-bold mb-6">Your Board</h1>
        {error ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg mb-2">Failed to load videos</p>
            <p className="text-sm mb-4">
              Please try refreshing the page.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-sm text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20" role="status">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="sr-only">Loading videos...</span>
          </div>
        ) : !videos.length ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg mb-2">No videos yet</p>
            <p className="text-sm">Paste a YouTube URL in the header to get started.</p>
          </div>
        ) : (
          <BoardGrid videos={videos} />
        )}
      </div>
    </Layout>
  );
}
