import { Layout } from "@/components/layout/Layout";
import { VideoIntakeForm } from "@/features/video-output/components/VideoIntakeForm";

export function GeneratePage() {
  return (
    <Layout showSidebar>
      <div className="surface-ambient relative flex-1 flex flex-col items-center justify-center page-gutter page-gutter-y overflow-hidden">
        {/* Ambient accent orb — quiet hero atmosphere behind the form. */}
        <div
          aria-hidden="true"
          className="vie-accent-orb"
          style={{
            ['--orb-size' as string]: '480px',
            bottom: '-120px',
            right: '-120px',
            background:
              'radial-gradient(closest-side, oklch(from var(--primary) l c h / 0.5), transparent 70%)',
          }}
        />

        <div className="relative max-w-2xl w-full stack-xl">
          <div className="stack-sm text-center">
            <p className="type-eyebrow text-[0.6875rem] font-mono uppercase tracking-[0.18em] text-muted-foreground/80">
              <span className="inline-block h-1 w-1 rounded-full bg-primary align-middle me-2" />
              New summary
            </p>
            <h1 className="type-page-title text-balance">
              Turn a video into a study guide
            </h1>
            <p className="type-caption text-pretty max-w-md mx-auto">
              Paste a YouTube link and we&apos;ll break it down — summary, key points, flashcards, and more.
            </p>
          </div>

          <VideoIntakeForm />
        </div>
      </div>
    </Layout>
  );
}
