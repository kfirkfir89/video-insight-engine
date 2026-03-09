import { useParams, Link, useNavigate } from "react-router-dom";
import { useCallback, useMemo } from "react";
import { useVideo, useRetryVideo } from "@/hooks/use-videos";
import { useSummaryStream } from "@/hooks/use-summary-stream";
import { useProcessingStore } from "@/stores/processing-store";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Loader2, ArrowLeft, RefreshCw, AlertCircle } from "lucide-react";
import { OutputRouter } from "@/components/video-detail/OutputRouter";
import type { VideoOutput } from "@vie/types";

export function VideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useVideo(id || "");
  const retryVideo = useRetryVideo();

  // Extract data safely (may be undefined during loading/error)
  const video = data?.video;
  const cachedOutput = data?.output ?? null;

  // Determine if we should stream
  const isProcessing = video?.status === "pending" || video?.status === "processing";
  const videoSummaryId = video?.videoSummaryId || "";

  // Skip page-level stream when useProcessingManager already has one active
  // (prevents duplicate SSE requests for the same video)
  const hasManagerStream = useProcessingStore(
    (s) => videoSummaryId ? s.streams.has(videoSummaryId) : false
  );

  // Stable callback to avoid recreating on every render
  const handleStreamComplete = useCallback(() => {
    refetch();
  }, [refetch]);

  // Handle retry for failed videos
  const handleRetry = useCallback(() => {
    if (!video?.youtubeId) return;
    retryVideo.mutate(
      { youtubeId: video.youtubeId, folderId: video.folderId },
      {
        onSuccess: (result) => {
          // Navigate to the new video
          navigate(`/video/${result.video.id}`);
        },
      }
    );
  }, [video?.youtubeId, video?.folderId, retryVideo, navigate]);

  // Use streaming hook when processing
  const streamState = useSummaryStream({
    videoSummaryId,
    enabled: isProcessing && !!videoSummaryId && !hasManagerStream,
    onComplete: handleStreamComplete,
  });


  // Memoize merged video object to avoid creating new reference on every render
  // Must be called before early returns (Rules of Hooks)
  const mergedVideo = useMemo(() => {
    if (!video) return null;
    return {
      ...video,
      // Use streamed metadata if available
      title: streamState.metadata?.title || video.title,
      channel: streamState.metadata?.channel || video.channel,
      thumbnailUrl: streamState.metadata?.thumbnailUrl || video.thumbnailUrl,
      duration: streamState.duration || video.duration,
      // Use streamed context or fall back to video context
      context: streamState.metadata?.context || video.context,
    };
  }, [video, streamState.metadata, streamState.duration]);

  // Build structured output from streaming state or cached API response
  const output = useMemo((): VideoOutput | null => {
    // Cached result from the API (completed video)
    if (cachedOutput) return cachedOutput;
    // Build from streaming state if we have intent
    if (isProcessing && streamState.intent) {
      return {
        outputType: streamState.intent.outputType,
        intent: streamState.intent,
        output: streamState.output ?? { type: streamState.intent.outputType, data: {} as never },
        synthesis: streamState.synthesis ?? { tldr: "", keyTakeaways: [], masterSummary: "", seoDescription: "" },
        ...(streamState.enrichment ? { enrichment: streamState.enrichment } : {}),
      };
    }
    return null;
  }, [cachedOutput, isProcessing, streamState.intent, streamState.output, streamState.synthesis, streamState.enrichment]);

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
  if (error || !data || !mergedVideo) {
    return (
      <Layout>
        <div className="text-center p-4 md:p-6 py-12">
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
            <Link to="/">
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
    streamState.phase !== "done" &&
    streamState.phase !== "cancelled" &&
    streamState.phase !== "error";


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
      <Layout>
        <OutputRouter
          video={mergedVideo}
          output={output}
          isStreaming={isStreaming}
          streamingState={isProcessing ? streamState : undefined}
        />
      </Layout>
    </ErrorBoundary>
  );
}

