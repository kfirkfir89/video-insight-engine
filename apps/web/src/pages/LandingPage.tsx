import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Sparkles, ArrowRight, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { useAddVideo } from "@/hooks/use-videos";
import { isYouTubeUrl } from "@/lib/youtube-utils";

const OUTPUT_EXAMPLES = [
  { emoji: "\u{1F373}", label: "Recipes" },
  { emoji: "\u{1F4BB}", label: "Tutorials" },
  { emoji: "\u{1F4DA}", label: "Study Guides" },
  { emoji: "\u{1F4AA}", label: "Workouts" },
];

function OutputExamples() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto pt-4">
      {OUTPUT_EXAMPLES.map((item) => (
        <div key={item.label} className="glass rounded-xl p-3 text-center text-sm">
          <div className="text-2xl mb-1">{item.emoji}</div>
          <div className="text-muted-foreground text-xs">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

function LandingHeader({ isAuthenticated }: { isAuthenticated: boolean }) {
  const navigate = useNavigate();
  return (
    <header className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <span className="font-bold text-gradient-primary">VIE</span>
      </div>
      <div className="flex items-center gap-2">
        {isAuthenticated ? (
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            Dashboard
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Log in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/register">Sign up</Link>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}

export function LandingPage() {
  const [url, setUrl] = useState("");
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const addVideo = useAddVideo();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || !isYouTubeUrl(trimmed)) return;

    if (isAuthenticated) {
      try {
        const result = await addVideo.mutateAsync({ url: trimmed });
        if (result?.video?.id) {
          navigate(`/video/${result.video.id}`);
        }
      } catch {
        // addVideo.isError is set automatically by React Query
      }
    } else {
      navigate("/login", { state: { returnUrl: trimmed } });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LandingHeader isAuthenticated={isAuthenticated} />

      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-20">
        <div className="max-w-2xl w-full text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              Transform videos into{" "}
              <span className="text-gradient-primary">structured knowledge</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto">
              Paste a YouTube URL and get an AI-generated summary — organized by topic, with recipes, tutorials, study guides, and more.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="relative max-w-xl mx-auto">
            <div className="glass rounded-2xl p-1.5 flex items-center gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0 pl-4">
                <Play className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste a YouTube URL..."
                  className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/60 py-2.5"
                  aria-label="YouTube video URL"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                className="rounded-xl px-4 shrink-0"
                disabled={!url.trim() || !isYouTubeUrl(url.trim()) || addVideo.isPending}
              >
                {addVideo.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Summarize
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </form>

          {addVideo.isError && (
            <p className="text-destructive text-sm">Failed to process video. Please try again.</p>
          )}

          <OutputExamples />
        </div>
      </main>

      <footer className="text-center text-xs text-muted-foreground/50 py-4">
        Video Insight Engine
      </footer>
    </div>
  );
}
