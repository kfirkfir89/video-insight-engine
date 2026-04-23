import { useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { ArrowRight, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { isYouTubeUrl } from "@/lib/youtube-utils";
import { cn } from "@/lib/utils";

import { LandingHeader } from "@/components/landing/LandingHeader";
import { StreamingDemoLoop } from "@/components/landing/StreamingDemoLoop";
import { PreviewTimeline } from "@/components/landing/PreviewTimeline";
import { PreviewQuiz } from "@/components/landing/PreviewQuiz";
import { PreviewTakeaways } from "@/components/landing/PreviewTakeaways";

import "@/styles/landing.css";

/** A short, popular video with high-quality summary output — good first impression. */
const SAMPLE_VIDEO_URL =
  import.meta.env.VITE_SAMPLE_VIDEO_URL ??
  "https://www.youtube.com/watch?v=8jPQjjsBbIc";

export function LandingPage(): ReactElement {
  const [url, setUrl] = useState<string>("");
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Authenticated users skip the funnel — straight to board.
  if (isAuthenticated) {
    return <Navigate to="/board" replace />;
  }

  const trimmed = url.trim();
  const isInvalid = trimmed.length > 0 && !isYouTubeUrl(trimmed);

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    if (!trimmed || isInvalid) return;
    navigate("/login", {
      state: { returnUrl: `/generate?url=${encodeURIComponent(trimmed)}` },
    });
  }

  function handleSample(): void {
    navigate("/login", {
      state: {
        returnUrl: `/generate?url=${encodeURIComponent(SAMPLE_VIDEO_URL)}`,
      },
    });
  }

  return (
    <div className="landing-shell landing-grid-paper min-h-dvh flex flex-col bg-background text-foreground">
      <div
        className="w-full mx-auto"
        style={{ maxWidth: "var(--landing-max)", paddingInline: "var(--landing-gutter)" }}
      >
        <LandingHeader />
      </div>

      <main
        className="flex-1 w-full mx-auto pb-24"
        style={{ maxWidth: "var(--landing-max)", paddingInline: "var(--landing-gutter)" }}
      >
        {/* ── Editorial hero: headline left, live demo right ── */}
        <section
          aria-labelledby="landing-headline"
          className="pt-8 sm:pt-12 lg:pt-20"
        >
          <div className="landing-hero-grid">
            <div className="flex flex-col justify-center gap-8">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.15em] text-muted-foreground mb-6">
                  <span className="h-1 w-1 rounded-full bg-primary" aria-hidden="true" />
                  Watch less · Learn everything
                </div>
                <h1 id="landing-headline" className="landing-display text-balance">
                  Any YouTube video,
                  <br />
                  turned into an app you can use.
                </h1>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
                  Paste a link. VIE extracts the lecture, the recipe, the code,
                  the chapters — as structured, interactive surfaces. Not a
                  transcript. Not a summary. A thing you can study from.
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-3 max-w-xl"
                noValidate
              >
                <div className="landing-input" data-invalid={isInvalid ? "true" : "false"}>
                  <Play
                    className="h-4 w-4 text-muted-foreground shrink-0"
                    aria-hidden="true"
                  />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="youtube.com/watch?v=…"
                    aria-label="YouTube video URL"
                    aria-invalid={isInvalid || undefined}
                    aria-describedby={isInvalid ? "landing-url-error" : undefined}
                  />
                  <Button
                    type="submit"
                    size="default"
                    className={cn("cta-magnetic rounded-[10px] px-5 font-semibold shrink-0")}
                    disabled={!trimmed || isInvalid}
                  >
                    Summarize
                    <ArrowRight className="h-4 w-4 ms-1" aria-hidden="true" />
                  </Button>
                </div>

                {isInvalid && (
                  <p
                    id="landing-url-error"
                    className="text-xs text-destructive"
                    role="alert"
                  >
                    That doesn&apos;t look like a YouTube link. Try a watch URL
                    like <span className="font-mono">youtube.com/watch?v=…</span>
                  </p>
                )}

                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">No URL handy?</span>
                  <button
                    type="button"
                    onClick={handleSample}
                    className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 hover:bg-muted px-3 py-1 text-foreground font-medium transition-colors"
                  >
                    <Play
                      className="h-3 w-3 text-primary shrink-0"
                      aria-hidden="true"
                    />
                    Try a sample video
                  </button>
                </div>
              </form>
            </div>

            {/* Right column — the live streaming demo (hero asset) */}
            <div className="relative flex items-stretch">
              <div className="w-full self-stretch">
                <StreamingDemoLoop tabPortalId="hero-tab-strip" />
              </div>
            </div>
          </div>

          {/* Tab strip — portaled here from StreamingDemoLoop */}
          <div id="hero-tab-strip" className="mt-6" />
        </section>

        {/* ── Proof section: 12-col bento ── */}
        <section
          aria-labelledby="showcase-heading"
          className="pt-20 sm:pt-28"
        >
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.15em] text-muted-foreground mb-3">
                <span className="h-1 w-1 rounded-full bg-primary" aria-hidden="true" />
                What actually comes out
              </div>
              <h2 className="font-display font-bold text-4xl md:text-5xl leading-[1.02] tracking-[-0.025em] text-foreground text-balance">
                Three tabs from one talk.
                <br />
                Real interactions, not screenshots.
              </h2>
            </div>
            <p className="max-w-sm text-sm text-muted-foreground text-pretty">
              Try the quiz. Scrub the timeline. These are the real components
              your processed videos render with — wired up, below, right now.
            </p>
          </div>

          <div className="landing-bento">
            <div className="landing-bento__timeline">
              <PreviewTimeline />
            </div>
            <div className="landing-bento__quiz">
              <PreviewQuiz />
            </div>
            <div className="landing-bento__takeaways">
              <PreviewTakeaways />
            </div>
          </div>
        </section>

        {/* ── Final CTA line ── */}
        <section className="pt-20 sm:pt-28">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 py-10 border-t border-border/60">
            <div>
              <h2 className="font-display font-bold text-3xl md:text-4xl leading-tight tracking-[-0.02em] text-foreground">
                Paste a link. Get the app.
              </h2>
              <p className="text-muted-foreground mt-1.5">
                Free to try. Sign in takes a keystroke.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="lg" variant="ghost" onClick={handleSample}>
                <Play className="h-4 w-4 me-1 text-primary" aria-hidden="true" />
                Try sample
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer
        className="w-full mx-auto py-8 flex items-center justify-between text-xs text-muted-foreground/70"
        style={{ maxWidth: "var(--landing-max)", paddingInline: "var(--landing-gutter)" }}
      >
        <span className="font-mono uppercase tracking-[0.15em]">Video Insight Engine</span>
      </footer>
    </div>
  );
}
