import { useParams, Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo } from "react";
import { useVideo, useRetryVideo } from "@/hooks/use-videos";
import { useSummaryStream } from "@/hooks/use-summary-stream";
import { useProcessingStore } from "@/stores/processing-store";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Loader2, ArrowLeft, RefreshCw, AlertCircle } from "lucide-react";
import { OutputRouter } from "@/components/video-detail/OutputRouter";
import { VideoPlayerProvider } from "@/contexts/VideoPlayerContext";
import { CollapsibleVideoPlayer } from "@/components/video-detail/shell/CollapsibleVideoPlayer";
import { buildSynthesisFromMeta } from "@/lib/synthesis-utils";
import type { TabEntry } from "@vie/types";

export function VideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useVideo(id ?? "");
  const retryVideo = useRetryVideo();

  // Extract data safely (may be undefined during loading/error)
  const video = data ?? null;

  // Determine if we should stream
  const isProcessing = video?.status === "pending" || video?.status === "processing";
  const videoSummaryId = video?.videoSummaryId || "";

  // Tell the processing manager to yield streaming to the page-level hook
  // (the manager aborts its stream when viewingVideoSummaryId is set)
  const setViewingVideo = useProcessingStore((s) => s.setViewingVideo);
  useEffect(() => {
    if (videoSummaryId) {
      setViewingVideo(videoSummaryId);
    }
    return () => {
      setViewingVideo(null);
    };
  }, [videoSummaryId, setViewingVideo]);

  // Stable callback to avoid recreating on every render
  const handleStreamComplete = useCallback(() => {
    refetch();
  }, [refetch]);

  // Handle retry for failed videos
  const handleRetry = () => {
    if (!video?.youtubeId) return;
    retryVideo.mutate(
      { youtubeId: video.youtubeId, folderId: video.folderId },
      {
        onSuccess: (result) => {
          navigate(`/video/${result.video.id}`);
        },
      }
    );
  };

  // Use streaming hook when processing
  const {
    metadata: streamMetadata,
    duration: streamDuration,
    tabs: streamTabs,
    meta: streamMeta,
    synthesis: streamSynthesis,
    tabCount,
    tabLabels,
    phase,
  } = useSummaryStream({
    videoSummaryId,
    enabled: isProcessing && !!videoSummaryId,
    onComplete: handleStreamComplete,
  });

  // Merge streamed metadata into video object
  const mergedVideo = useMemo(() => {
    if (!video) return null;
    return {
      ...video,
      title: streamMetadata?.title || video.title,
      creator: streamMetadata?.channel || video.creator,
      thumbnailUrl: streamMetadata?.thumbnailUrl || video.thumbnailUrl,
      duration: streamDuration || video.duration,
    };
  }, [video, streamMetadata, streamDuration]);

  // Resolve tabs: prefer streaming tabs, then cached tabs from API
  const resolvedTabs = useMemo((): TabEntry[] | null => {
    if (streamTabs.length > 0) return streamTabs;
    if (video?.tabs && Array.isArray(video.tabs) && video.tabs.length > 0) return video.tabs as TabEntry[];
    return null;
  }, [video?.tabs, streamTabs]);

  // Resolve meta: prefer streaming meta, then cached meta from API
  const resolvedMeta = useMemo(() => {
    if (streamMeta) return streamMeta;
    return video?.meta ?? null;
  }, [video?.meta, streamMeta]);

  // Resolve synthesis for TLDR/takeaways display
  const synthesis = useMemo(() => {
    if (streamSynthesis) return streamSynthesis;
    return buildSynthesisFromMeta(resolvedMeta);
  }, [streamSynthesis, resolvedMeta]);

  // Loading state
  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center p-4 md:p-6 py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // Error state
  if (error || !video || !mergedVideo) {
    return (
      <Layout>
        <div className="text-center p-4 md:p-6 py-12">
          <p className="text-red-500">Failed to load video</p>
          <Link to="/board">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  // Failed state - show retry button
  if (video?.status === "failed") {
    return (
      <Layout>
        <div className="text-center p-4 md:p-6 py-12">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Summarization Failed</h2>
          <p className="text-muted-foreground mb-6">
            Something went wrong while processing this video.
          </p>
          <div className="flex gap-3 justify-center">
            <Link to="/board">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            </Link>
            <Button onClick={handleRetry} disabled={retryVideo.isPending}>
              {retryVideo.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Retry
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const isStreaming = isProcessing &&
    phase !== "done" &&
    phase !== "cancelled" &&
    phase !== "error";

  // Issue #13: Error boundary fallback for rendering errors from malformed streaming state
  const errorFallback = (
    <Layout>
      <div className="text-center p-4 md:p-6 py-12">
        <p className="text-red-500">Failed to render video content</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Reload Page
        </Button>
      </div>
    </Layout>
  );

  return (
    <ErrorBoundary key={id} fallback={errorFallback}>
      <VideoPlayerProvider>
        <Layout>
          <div className="mx-auto w-full max-w-4xl px-4 pt-4 md:px-6 md:pt-6">
            {video.youtubeId && (
              <CollapsibleVideoPlayer
                youtubeId={video.youtubeId}
                title={mergedVideo.title}
              />
            )}
          </div>
          <OutputRouter
            title={mergedVideo.title}
            videoSummaryId={videoSummaryId}
            tabs={resolvedTabs}
            meta={resolvedMeta}
            synthesis={synthesis}
            isStreaming={isStreaming}
            tabCount={tabCount}
            tabLabels={tabLabels}
            youtubeId={video.youtubeId}
            creator={mergedVideo.creator ?? undefined}
            duration={mergedVideo.duration}
          />
        </Layout>
      </VideoPlayerProvider>
    </ErrorBoundary>
  );
}

