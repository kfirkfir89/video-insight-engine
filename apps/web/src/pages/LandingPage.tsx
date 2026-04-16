import { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { Sparkles, ArrowRight, Play, Wand2, BookOpen, Target, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { isYouTubeUrl } from "@/lib/youtube-utils";

/** A short, popular video with high-quality summary output — good first impression. */
const SAMPLE_VIDEO_URL = "https://www.youtube.com/watch?v=8jPQjjsBbIc";

function DemoVignette() {
  return (
    <div
      className="orbs-ambient relative mx-auto max-w-xl mt-8 rounded-2xl border border-[var(--glass-border-strong)] bg-[var(--glass-bg)] backdrop-blur-xl p-4"
      style={{ boxShadow: "var(--glass-shadow-elevated)" }}
      aria-hidden="true"
    >
      {/* Mock URL bar */}
      <div className="flex items-center gap-2 h-8 rounded-lg bg-muted/30 px-3 text-xs text-muted-foreground mb-3">
        <Play className="h-3 w-3 opacity-50" />
        <span className="vignette-typing font-mono" />
      </div>

      {/* Mock tab pills */}
      <div className="flex gap-1.5 mb-3">
        <div
          className="vignette-tab h-6 rounded-full bg-primary/20 px-3 flex items-center gap-1.5 text-xs font-semibold"
          style={{ animationDelay: "1.8s" }}
        >
          <BookOpen className="h-3 w-3" /> Summary
        </div>
        <div
          className="vignette-tab h-6 rounded-full bg-muted/40 px-3 flex items-center gap-1.5 text-xs"
          style={{ animationDelay: "2.0s" }}
        >
          <Target className="h-3 w-3" /> Key Points
        </div>
        <div
          className="vignette-tab h-6 rounded-full bg-muted/40 px-3 flex items-center gap-1.5 text-xs"
          style={{ animationDelay: "2.2s" }}
        >
          <HelpCircle className="h-3 w-3" /> Quiz
        </div>
      </div>

      {/* Mock content lines */}
      <div className="space-y-2">
        <div className="vignette-line h-3 rounded bg-muted/30" style={{ animationDelay: "2.8s" }} />
        <div className="vignette-line h-3 rounded bg-muted/30 w-4/5" style={{ animationDelay: "3.0s" }} />
        <div className="vignette-line h-3 rounded bg-muted/30 w-3/5" style={{ animationDelay: "3.2s" }} />
      </div>
    </div>
  );
}

function LandingHeader() {
  return (
    <header className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <span className="font-bold text-foreground">VIE</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/login">Log in</Link>
        </Button>
        <Button size="sm" asChild>
          <Link to="/register">Sign up</Link>
        </Button>
      </div>
    </header>
  );
}

export function LandingPage() {
  const [url, setUrl] = useState("");
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Auto-redirect authenticated users to their board
  if (isAuthenticated) {
    return <Navigate to="/board" replace />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || !isYouTubeUrl(trimmed)) return;
    navigate("/login", { state: { returnUrl: `/generate?url=${encodeURIComponent(trimmed)}` } });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background bg-[var(--gradient-hero-bg)]">
      <LandingHeader />

      <main className="flex-1 flex flex-col items-center justify-center page-gutter pb-20">
        <div className="max-w-2xl w-full hero-rhythm">
          <div className="stack-md text-start sm:text-center">
            <h1 className="type-hero-xl text-foreground text-balance">
              Watch less. Learn everything.
            </h1>
            <p className="type-lead max-w-md sm:mx-auto text-pretty">
              Paste a YouTube URL. Get interactive study guides, flashcards,
              recipes, and more — in seconds.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="relative max-w-xl mx-auto">
            <div className="glass rounded-2xl p-1.5 flex items-center gap-2 ring-1 ring-[var(--glass-border)] focus-within:ring-1 focus-within:ring-primary/25 focus-within:shadow-[0_0_20px_-8px_var(--primary)] transition-shadow duration-300">
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
                size="default"
                className="cta-magnetic rounded-xl px-6 font-bold shrink-0"
                disabled={!url.trim() || !isYouTubeUrl(url.trim())}
              >
                Summarize
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </form>

          <div className="flex items-center justify-center gap-2 max-w-xl mx-auto text-sm">
            <span className="text-muted-foreground">or</span>
            <button
              type="button"
              onClick={() => {
                navigate("/login", { state: { returnUrl: `/generate?url=${encodeURIComponent(SAMPLE_VIDEO_URL)}` } });
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 hover:bg-muted px-3 py-1.5 text-foreground font-medium transition-colors"
            >
              <Wand2 className="h-3.5 w-3.5 text-primary" />
              Try with a sample video
            </button>
          </div>

          <DemoVignette />
        </div>
      </main>

      <footer className="text-center text-xs text-muted-foreground/50 py-4">
        Video Insight Engine
      </footer>
    </div>
  );
}
