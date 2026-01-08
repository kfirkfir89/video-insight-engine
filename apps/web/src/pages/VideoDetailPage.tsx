import { useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useVideo } from "@/hooks/use-videos";
import { Layout } from "@/components/layout/Layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Clock, CheckCircle } from "lucide-react";
import { YouTubePlayer } from "@/components/videos/YouTubePlayer";
import type { YouTubePlayerRef } from "@/components/videos/YouTubePlayer";

export function VideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useVideo(id || "");
  const playerRef = useRef<YouTubePlayerRef>(null);

  const handleSeekToSection = (startSeconds: number) => {
    playerRef.current?.seekTo(startSeconds);
    playerRef.current?.playVideo();
    document.getElementById("video-player")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Layout>
      {/* Back button */}
      <Link to="/">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </Link>

      {/* Video Header */}
      <div className="flex flex-col md:flex-row gap-6 mb-8">
        <div id="video-player" className="w-full md:w-[480px] lg:w-[560px]">
          {video.youtubeId ? (
            <YouTubePlayer
              ref={playerRef}
              youtubeId={video.youtubeId}
              className="w-full"
            />
          ) : video.thumbnailUrl ? (
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="w-full rounded-lg object-cover aspect-video"
            />
          ) : null}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold mb-2">{video.title}</h1>
          {video.channel && (
            <p className="text-muted-foreground mb-2">{video.channel}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {video.duration && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDuration(video.duration)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              {video.status}
            </span>
          </div>
        </div>
      </div>

      {!summary ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Summary not available yet. Video may still be processing.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* TLDR */}
          <Card>
            <CardHeader>
              <CardTitle>TL;DR</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{summary.tldr}</p>
            </CardContent>
          </Card>

          {/* Key Takeaways */}
          {summary.keyTakeaways && summary.keyTakeaways.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Key Takeaways</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-2">
                  {summary.keyTakeaways.map((takeaway, i) => (
                    <li key={i}>{takeaway}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Sections */}
          {summary.sections && summary.sections.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Sections</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {summary.sections.map((section) => (
                  <div key={section.id} className="border-b pb-4 last:border-0">
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        onClick={() => handleSeekToSection(section.startSeconds)}
                        className="text-xs bg-primary/10 text-primary px-2 py-1 rounded hover:bg-primary/20 transition-colors cursor-pointer"
                        aria-label={`Jump to ${section.timestamp}`}
                      >
                        {section.timestamp}
                      </button>
                      <h3 className="font-semibold">{section.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {section.summary}
                    </p>
                    {section.bullets && section.bullets.length > 0 && (
                      <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                        {section.bullets.map((bullet, i) => (
                          <li key={i}>{bullet}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Concepts */}
          {summary.concepts && summary.concepts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Concepts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {summary.concepts.map((concept) => (
                    <div
                      key={concept.id}
                      className="p-3 bg-muted/50 rounded-lg"
                    >
                      <h4 className="font-medium">{concept.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {concept.definition}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </Layout>
  );
}
