import { memo } from "react";
import { ArrowUpRight } from "lucide-react";

interface Takeaway {
  readonly num: string;
  readonly heading: string;
  readonly body: string;
}

const TAKEAWAYS: readonly Takeaway[] = [
  {
    num: "01",
    heading: "Paste once, get an app",
    body: "Not a wall of text — a structured surface with quiz, timeline, flashcards, and chapters.",
  },
  {
    num: "02",
    heading: "Tabs adapt per video",
    body: "Recipes get ingredients. Tutorials get code. Lectures get quizzes. The shape follows the content.",
  },
  {
    num: "03",
    heading: "Stream as it thinks",
    body: "Tabs populate live so you can start reading in seconds — not wait for a spinner.",
  },
] as const;

/**
 * Wide horizontal band — the third bento region. Three
 * takeaway columns, numbered editorially, no card chrome
 * inside so the band reads as one unified row.
 */
export const PreviewTakeaways = memo(function PreviewTakeaways() {
  return (
    <article className="landing-card">
      <div className="flex items-baseline justify-between gap-4 mb-5">
        <span className="landing-card__label !mb-0">
          <span className="landing-card__label-num">03</span>
          Why it's different
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-mono">
          three takeaways
          <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden="true" />
        </span>
      </div>

      <div className="landing-takeaways-grid">
        {TAKEAWAYS.map((t) => (
          <div key={t.num} className="landing-takeaway-item">
            <span className="landing-takeaway-item__num">{t.num}</span>
            <h4 className="font-display font-bold text-lg text-foreground tracking-tight">
              {t.heading}
            </h4>
            <p className="landing-takeaway-item__body">{t.body}</p>
          </div>
        ))}
      </div>
    </article>
  );
});
