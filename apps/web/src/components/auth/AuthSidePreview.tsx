import { memo } from "react";
import { BookOpen, Sparkles, Clock, HelpCircle, Lightbulb } from "lucide-react";

/**
 * AuthSidePreview — quiet editorial preview on the left of the auth shell.
 *
 * Intentionally static: the form is the task on this page, so a looping
 * animation would pull focus. This shows a single representative output
 * snapshot — eyebrow + headline + a console card + the tab strip — so the
 * visitor sees *what they're signing in to* instead of a card in a void.
 *
 * Styled with project tokens only (no dependency on landing.css) so the
 * auth route stays self-contained.
 */
export const AuthSidePreview = memo(function AuthSidePreview() {
  return (
    <div className="w-full max-w-xl stack-lg">
      <div className="stack-sm">
        <p className="type-eyebrow text-[0.6875rem] font-mono uppercase tracking-[0.18em] text-muted-foreground/80">
          <span className="inline-block h-1 w-1 rounded-full bg-primary align-middle me-2" />
          What you sign in to
        </p>
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.05] text-balance">
          Any long video,
          <br />
          one <em className="not-italic text-primary">studyable</em> app.
        </h2>
        <p className="type-caption text-pretty max-w-md">
          VIE extracts the lecture, the recipe, the code — as structured,
          interactive surfaces. Your library sits in the next tab.
        </p>
      </div>

      {/* Snapshot console — frozen Timeline tab. Pure tokens, no landing.css. */}
      <div
        className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-[8px] overflow-hidden shadow-[0_12px_40px_-16px_oklch(from_var(--primary)_l_c_h_/_0.35)]"
        aria-hidden="true"
      >
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border/40 bg-background/30">
          <span className="h-2.5 w-2.5 rounded-full bg-[oklch(62%_0.16_25)]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[oklch(78%_0.15_80)]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[oklch(62%_0.14_150)]/70" />
          <span className="ms-3 text-[0.6875rem] font-mono text-muted-foreground/80 truncate">
            youtube.com/watch?v=what-you-just-watched
          </span>
        </div>

        <div className="p-5 stack-sm">
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full border border-border/40 bg-muted/40 self-start text-[0.6875rem] font-mono uppercase tracking-[0.12em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-[--status-success]" />
            Ready · 5 tabs
          </div>
          <div className="text-sm font-semibold text-foreground/90">
            Scrubbable chapters
          </div>
          <ul className="stack-xs">
            {CHAPTERS.map((chapter) => (
              <li
                key={chapter.time}
                className="flex items-baseline gap-3 text-sm text-foreground/85"
              >
                <span className="tabular-nums text-xs text-muted-foreground min-w-[3rem]">
                  {chapter.time}
                </span>
                <span className="text-pretty">{chapter.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Tab strip — the 5 canonical tabs, each a glyph + label. */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <span
              key={tab.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-border/50 bg-card/40 text-muted-foreground"
            >
              <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
              {tab.label}
            </span>
          );
        })}
      </div>

      {/* Quiet proof strip — tabular-num chips, monospace label. */}
      <ul className="flex gap-x-5 text-[0.6875rem] font-mono uppercase tracking-[0.14em] text-muted-foreground/70 pt-1">
        <li className="tabular-nums">10 domains</li>
        <li aria-hidden="true" className="opacity-30">·</li>
        <li className="tabular-nums">~40s first tab</li>
        <li aria-hidden="true" className="opacity-30">·</li>
        <li className="tabular-nums">$0.00 cached</li>
      </ul>
    </div>
  );
});

const CHAPTERS = [
  { time: "0:00", label: "Why most dashboards fail" },
  { time: "6:12", label: "The one-chart rule" },
  { time: "18:40", label: "Live critique of a real dashboard" },
  { time: "34:05", label: "Q&A and contrarian takes" },
] as const;

const TABS = [
  { id: "summary", label: "Summary", icon: BookOpen },
  { id: "key-points", label: "Key Points", icon: Sparkles },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "quiz", label: "Quiz", icon: HelpCircle },
  { id: "takeaways", label: "Takeaways", icon: Lightbulb },
] as const;
