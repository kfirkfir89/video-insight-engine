import { useParams, Link, useNavigate } from "react-router-dom";
import { useCallback, useMemo } from "react";
import { useVideo, useRetryVideo } from "@/hooks/use-videos";
import { useSummaryStream, type StreamState } from "@/hooks/use-summary-stream";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Loader2, ArrowLeft, RefreshCw, AlertCircle } from "lucide-react";
import { VideoDetailLayout } from "@/components/video-detail";
import { StreamingIndicator } from "@/components/video-detail/StreamingIndicator";
import type { VideoSummary, SummaryChapter, Concept } from "@vie/types";

export function VideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useVideo(id || "");
  const retryVideo = useRetryVideo();

  // Extract data safely (may be undefined during loading/error)
  const video = data?.video;
  const cachedSummary = data?.summary;

  // Determine if we should stream
  const isProcessing = video?.status === "pending" || video?.status === "processing";
  const videoSummaryId = video?.videoSummaryId || "";

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
    enabled: isProcessing && !!videoSummaryId,
    onComplete: handleStreamComplete,
  });

  // Memoize summary to avoid rebuilding on every render
  // Must be called before early returns (Rules of Hooks)
  const summary = useMemo(() => {
    if (!cachedSummary && !isProcessing) return null;
    if (isProcessing && streamState.phase !== "idle" && streamState.phase !== "connecting") {
      return buildSummaryFromStream(streamState);
    }
    return cachedSummary ?? null;
  }, [isProcessing, streamState, cachedSummary]);

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

  // Loading state
  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // Error state
  if (error || !data || !mergedVideo) {
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

  // Failed state - show retry button
  if (video?.status === "failed") {
    return (
      <Layout>
        <div className="text-center py-12">
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

  // Show streaming indicator when processing (not done, cancelled, or error)
  const showStreamingIndicator = isProcessing &&
    streamState.phase !== "done" &&
    streamState.phase !== "error" &&
    streamState.phase !== "cancelled";
  const isStreaming = isProcessing &&
    streamState.phase !== "done" &&
    streamState.phase !== "cancelled" &&
    streamState.phase !== "error";

  // Issue #13: Error boundary fallback for rendering errors from malformed streaming state
  const errorFallback = (
    <Layout>
      <div className="text-center py-12">
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
    <>
      {showStreamingIndicator && (
        <StreamingIndicator
          phase={streamState.phase}
          currentChapterIndex={streamState.currentChapterIndex}
          totalChapters={streamState.chapters.length}
        />
      )}
      <ErrorBoundary key={id} fallback={errorFallback}>
        <VideoDetailLayout
          video={mergedVideo}
          summary={summary}
          isStreaming={isStreaming}
          streamingState={isProcessing ? streamState : undefined}
          chapters={isProcessing ? streamState.chapters : video?.chapters}
          isCreatorChapters={isProcessing ? streamState.isCreatorChapters : video?.chapterSource === "creator"}
          descriptionAnalysis={isProcessing ? streamState.descriptionAnalysis : video?.descriptionAnalysis}
          onStopSummarization={isStreaming ? streamState.stop : undefined}
        />
      </ErrorBoundary>
    </>
  );
}

/**
 * Build a VideoSummary object from the current stream state.
 * This allows displaying partial data while streaming.
 */
function buildSummaryFromStream(state: StreamState): VideoSummary | null {
  // If we have no meaningful data yet, return null
  if (!state.tldr && state.chapters.length === 0 && state.concepts.length === 0) {
    return null;
  }

  return {
    tldr: state.tldr || "",
    keyTakeaways: state.keyTakeaways || [],
    chapters: state.chapters.map((s): SummaryChapter => ({
      id: s.id,
      timestamp: s.timestamp,
      startSeconds: s.startSeconds,
      endSeconds: s.endSeconds,
      title: s.title,
      originalTitle: s.originalTitle,
      generatedTitle: s.generatedTitle,
      isCreatorChapter: s.isCreatorChapter,
      content: s.content, // Dynamic content blocks - source of truth
    })),
    concepts: state.concepts.map((c): Concept => ({
      id: c.id,
      name: c.name,
      definition: c.definition || "",
      timestamp: c.timestamp ?? null,
    })),
  };
}
