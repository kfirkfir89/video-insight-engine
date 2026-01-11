import { useParams, Link } from "react-router-dom";
import { useVideo } from "@/hooks/use-videos";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import { VideoDetailLayout } from "@/components/video-detail";

export function VideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useVideo(id || "");

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-500">Failed to load video</p>
          <Link to="/">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const { video, summary } = data;

  return <VideoDetailLayout video={video} summary={summary} />;
}
