import { Component, useEffect, useMemo, type ReactNode } from "react";
import { useParams, Link } from "react-router-dom";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShareOutput } from "@/hooks/use-share";
import { OutputShell } from "@/components/video-detail/output/OutputShell";
import type { VideoResponse, VideoOutput } from "@vie/types";

/** Error boundary for shared content — a malformed block shouldn't crash the page. */
class ShareContentBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("[ShareContentBoundary] Block render error:", error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>Some content could not be displayed.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export function SharePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: shareData, isLoading, error } = useShareOutput(slug ?? "");

  // Set document title for social sharing / SEO
  useEffect(() => {
    if (shareData?.title) {
      document.title = `${shareData.title} | VIE`;
    }
    return () => {
      document.title = "Video Insight Engine";
    };
  }, [shareData?.title]);

  // Build minimal VideoResponse for OutputShell
  const video = useMemo((): VideoResponse | null => {
    if (!shareData) return null;
    return {
      id: shareData.id,
      videoSummaryId: shareData.id,
      youtubeId: shareData.youtubeId,
      title: shareData.title,
      channel: shareData.channel,
      duration: shareData.duration,
      thumbnailUrl: shareData.thumbnailUrl,
      status: "completed",
      folderId: null,
      createdAt: new Date().toISOString(),
      outputType: shareData.outputType,
    };
  }, [shareData]);

  // Use the structured output directly from the API
  const output = useMemo((): VideoOutput | null => {
    return shareData?.output ?? null;
  }, [shareData?.output]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="sr-only">Loading shared content...</span>
      </div>
    );
  }

  if (error || !shareData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <h1 className="text-2xl font-bold">Content not found</h1>
        <p className="text-muted-foreground text-center max-w-md">
          This shared link may have expired or been removed.
        </p>
        <Button asChild>
          <Link to="/">
            Go to VIE <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Minimal header */}
      <header className="flex items-center justify-between px-6 py-4 border-b">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-bold text-gradient-primary">VIE</span>
        </Link>
        <Button size="sm" variant="outline" asChild>
          <Link to="/register">
            Try VIE free <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </header>

      {/* Shared content */}
      <main className="flex-1">
        <ShareContentBoundary>
          {video && output ? (
            <OutputShell video={video} output={output} />
          ) : (
            <div className="max-w-3xl mx-auto w-full px-4 py-8">
              <div className="glass rounded-2xl p-6 space-y-4">
                <h1 className="text-xl font-bold">{shareData.title}</h1>
                {shareData.tldr && (
                  <p className="text-muted-foreground">{shareData.tldr}</p>
                )}
              </div>
              <div className="mt-8 text-center text-sm text-muted-foreground/60">
                Shared via Video Insight Engine
              </div>
            </div>
          )}
        </ShareContentBoundary>
      </main>
    </div>
  );
}
