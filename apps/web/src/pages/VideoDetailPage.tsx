import { useParams, Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo } from "react";
import { useVideo, useRetryVideo } from "@/hooks/use-videos";
import { useSummaryStream } from "@/features/video-output/hooks/use-summary-stream";
import { useCelebrationTrigger } from "@/features/video-output/hooks/use-celebration-trigger";
import { useProcessingStore } from "@/features/video-output/stores/processing-store";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Loader2, ArrowLeft, RefreshCw, AlertCircle } from "lucide-react";
import { OutputRouter } from "@/features/video-output/components/OutputRouter";
import { VideoPlayerProvider } from "@/features/video-output/contexts/VideoPlayerContext";

import { Confetti } from "@/components/ui/Confetti";
import { buildSynthesisFromMeta } from "@/features/video-output/lib/synthesis-utils";
import { shouldOpenStreamForStatus } from "@/features/video-output/lib/streaming/should-open-stream";
import type { TabEntry } from "@vie/types";

export function VideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useVideo(id ?? "");
  const retryVideo = useRetryVideo();

  // Extract data safely (may be undefined during loading/error)
  const video = data ?? null;

  // Frontend stream dedup: only open `/stream` when the cached video record
  // says processing is in flight. COMPLETED → render cached output, do NOT
  // re-open the stream (saves a round-trip + a backend "additional consumer"
  // attach log). FAILED renders the retry UI further down — no auto-stream.
  const isProcessing = shouldOpenStreamForStatus(video?.status);
  const videoSummaryId = video?.videoSummaryId || "";

  // Tell the processing manager to yield streaming to the page-level hook
  // (the manager aborts its stream when viewingVideoSummaryId is set)
  const setViewingVideo = useProcessingStore((s) => s.setViewingVideo);
  const markCancelled = useProcessingStore((s) => s.markCancelled);
  const clearCancelled = useProcessingStore((s) => s.clearCancelled);
  // Whether THIS video was explicitly cancelled in this tab. Survives nav so
  // the user doesn't auto-resubscribe to a stream they already walked away
  // from. Cleared on Resume / Retry.
  const isCancelled = useProcessingStore(
    (s) => (videoSummaryId ? s.cancelledIds.has(videoSummaryId) : false),
  );
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
    extractionProgress,
    confettiCount,
    stop: stopStream,
  } = useSummaryStream({
    videoSummaryId,
    // Stream is enabled only when the backend says we're processing AND the
    // user hasn't explicitly cancelled in this tab. Without the cancel gate,
    // re-entering a video the user just cancelled would auto-resubscribe and
    // make the Cancel button feel decorative.
    enabled: isProcessing && !!videoSummaryId && !isCancelled,
    onComplete: handleStreamComplete,
  });

  // Cancel handler — flags the id as user-cancelled (so revisits show Resume
  // instead of re-attaching), aborts the local stream, and routes back to the
  // library. The backend pipeline keeps running; Resume reattaches when ready.
  const handleCancelStream = useCallback(() => {
    if (videoSummaryId) markCancelled(videoSummaryId);
    stopStream();
    navigate("/board");
  }, [stopStream, navigate, videoSummaryId, markCancelled]);

  // Resume handler — clears the cancel flag so the next render of this page
  // re-enables the stream subscription. No-op when the id isn't cancelled.
  const handleResumeStream = useCallback(() => {
    if (videoSummaryId) clearCancelled(videoSummaryId);
  }, [videoSummaryId, clearCancelled]);

  // Confetti: fires exactly once per video per session via the shared hook.
  // See use-celebration-trigger for the atomic per-id gating logic.
  const confettiTrigger = useCelebrationTrigger(videoSummaryId, confettiCount);

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
        <div className="text-center p-4 md:p-6 py-12 space-y-2">
          <p className="type-h3">We couldn&apos;t load this video</p>
          <p className="type-caption max-w-sm mx-auto">
            It may have been deleted, or you might not have access. Try going back to your library.
          </p>
          <Link to="/board">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="me-2 h-4 w-4" /> Back to library
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  // Failed state - show retry button + structured reasons
  if (video?.status === "failed") {
    const possibleCauses = [
      {
        title: "The video is private or unlisted",
        remedy: "Only public YouTube videos can be processed. Ask the creator to make it public, or try a different video.",
      },
      {
        title: "The video is age-restricted",
        remedy: "VIE can't access age-restricted content without signed-in cookies. Try an unrestricted alternative.",
      },
      {
        title: "The transcript language isn't supported yet",
        remedy: "We support most major languages. If the video has no captions or auto-captions, processing will fail.",
      },
      {
        title: "The video is very long",
        remedy: "Videos over 3 hours may time out. Try a shorter clip or a single section.",
      },
      {
        title: "Temporary network or AI service issue",
        remedy: "This is usually transient. Click Retry — it often works on the second attempt.",
      },
    ];

    return (
      <Layout>
        <div className="mx-auto max-w-xl p-4 md:p-6 py-12">
          <div className="flex flex-col items-center text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" aria-hidden="true" />
            <h2 className="text-xl font-semibold mb-2">We couldn't summarize this video</h2>
            <p className="text-muted-foreground mb-6">
              Something went wrong while processing. Here are the most likely reasons:
            </p>
          </div>

          <ul className="space-y-3 mb-8 text-sm">
            {possibleCauses.map((cause) => (
              <li key={cause.title} className="rounded-lg border border-border/50 bg-muted/20 p-3">
                <p className="font-medium text-foreground">{cause.title}</p>
                <p className="text-muted-foreground mt-1">{cause.remedy}</p>
              </li>
            ))}
          </ul>

          <div className="flex gap-3 justify-center">
            <Link to="/board">
              <Button variant="outline">
                <ArrowLeft className="me-2 h-4 w-4" /> Back
              </Button>
            </Link>
            <Button onClick={handleRetry} disabled={retryVideo.isPending}>
              {retryVideo.isPending ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="me-2 h-4 w-4" />
              )}
              Retry
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const isStreaming = isProcessing &&
    !isCancelled &&
    phase !== "done" &&
    phase !== "cancelled" &&
    phase !== "error";

  // User cancelled in this tab but the backend pipeline is still running.
  // Surface an explicit Resume control instead of silently re-attaching to
  // the SSE feed — that would make Cancel feel decorative.
  if (isProcessing && isCancelled) {
    return (
      <Layout>
        <div className="text-center p-4 md:p-6 py-12 space-y-3 max-w-md mx-auto">
          <p className="type-h3">You stopped watching this stream</p>
          <p className="type-caption">
            Processing is still running in the background. Resume to reattach to
            the live stream, or come back later — the video will be ready when
            you do.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <Link to="/board">
              <Button variant="outline">
                <ArrowLeft className="me-2 h-4 w-4" /> Back to library
              </Button>
            </Link>
            <Button onClick={handleResumeStream}>
              <RefreshCw className="me-2 h-4 w-4" /> Resume
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // Issue #13: Error boundary fallback for rendering errors from malformed streaming state
  const errorFallback = (
    <Layout>
      <div className="text-center p-4 md:p-6 py-12">
        <p className="type-h3 text-destructive">Something broke while rendering this video</p>
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
            language={resolvedMeta?.language}
            isRTL={resolvedMeta?.isRTL}
            streamPhase={phase}
            extractionProgress={extractionProgress}
            onCancelStream={isStreaming ? handleCancelStream : undefined}
          />
          <Confetti trigger={confettiTrigger} />
        </Layout>
      </VideoPlayerProvider>
    </ErrorBoundary>
  );
}

