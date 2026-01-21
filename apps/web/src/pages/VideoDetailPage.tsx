import { useParams, Link } from "react-router-dom";
import { useCallback, useMemo } from "react";
import { useVideo } from "@/hooks/use-videos";
import { useSummaryStream, type StreamState } from "@/hooks/use-summary-stream";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Loader2, ArrowLeft } from "lucide-react";
import { VideoDetailLayout } from "@/components/video-detail";
import { StreamingIndicator } from "@/components/video-detail/StreamingIndicator";
import type { VideoSummary, Section, Concept } from "@vie/types";

export function VideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error, refetch } = useVideo(id || "");

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
          currentSectionIndex={streamState.currentSectionIndex}
          totalSections={streamState.sections.length}
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
  if (!state.tldr && state.sections.length === 0 && state.concepts.length === 0) {
    return null;
  }

  return {
    tldr: state.tldr || "",
    keyTakeaways: state.keyTakeaways || [],
    sections: state.sections.map((s): Section => ({
      id: s.id,
      timestamp: s.timestamp,
      startSeconds: s.startSeconds,
      endSeconds: s.endSeconds,
      title: s.title,
      originalTitle: s.originalTitle,
      generatedTitle: s.generatedTitle,
      isCreatorChapter: s.isCreatorChapter,
      content: s.content, // Dynamic content blocks
      summary: s.summary,
      bullets: s.bullets,
    })),
    concepts: state.concepts.map((c): Concept => ({
      id: c.id,
      name: c.name,
      definition: c.definition || "",
      timestamp: c.timestamp ?? null,
    })),
  };
}
