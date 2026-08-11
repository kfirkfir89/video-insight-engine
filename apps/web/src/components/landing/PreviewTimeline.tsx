import { memo, useState } from "react";
import { Clock, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimelineEntry {
  readonly t: string;
  readonly label: string;
  readonly detail: string;
}

const TIMELINE_ENTRIES: readonly TimelineEntry[] = [
  {
    t: "0:00",
    label: "Cold open",
    detail: "Why most review dashboards fail in the first 90 seconds.",
  },
  {
    t: "6:12",
    label: "The one-chart rule",
    detail: "If it needs a legend, it's two charts pretending to be one.",
  },
  {
    t: "18:40",
    label: "Live critique",
    detail: "Walks a real SaaS dashboard through the framework.",
  },
  {
    t: "34:05",
    label: "Q&A and contrarian takes",
    detail: "What the speaker would steal from competitors, and what they wouldn't.",
  },
] as const;

/**
 * Wide timeline card — the "big" bento tile. Rows expand on
 * selection to show the detail pulled from the transcript.
 */
export const PreviewTimeline = memo(function PreviewTimeline() {
  const [selected, setSelected] = useState<number>(0);

  function handleSelect(index: number): void {
    setSelected(index);
  }

  return (
    <article className="landing-card h-full flex flex-col">
      <span className="landing-card__label">
        <span className="landing-card__label-num">01</span>
        Timeline
      </span>
      <h3 className="landing-card__title">
        Scrub any moment. Jump to the exact second.
      </h3>
      <p className="text-sm text-muted-foreground mb-5 max-w-[60ch]">
        Every chapter is click-through. We mark the beats that matter, not
        every "um" in the recording.
      </p>

      <ol className="relative ps-5 space-y-2.5 flex-1">
        <span
          aria-hidden="true"
          className="absolute start-[5px] top-2 bottom-2 w-px bg-border"
        />
        {TIMELINE_ENTRIES.map((entry, i) => {
          const isActive = i === selected;
          return (
            <li key={entry.t} className="relative">
              <span
                aria-hidden="true"
                className={cn(
                  "absolute -start-[17px] top-2.5 h-2 w-2 rounded-full ring-2 transition-colors",
                  isActive
                    ? "bg-primary ring-primary/20"
                    : "bg-muted-foreground/40 ring-transparent",
                )}
              />
              <button
                type="button"
                onClick={() => handleSelect(i)}
                aria-pressed={isActive}
                className={cn(
                  "w-full text-start rounded-lg px-2 py-1.5 transition-colors",
                  isActive ? "bg-primary/5" : "hover:bg-muted/40",
                )}
              >
                <div className="flex items-baseline gap-3">
                  <span
                    className={cn(
                      "font-mono text-xs tabular-nums shrink-0 w-10",
                      isActive ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {entry.t}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      isActive ? "text-foreground" : "text-foreground/80",
                    )}
                  >
                    {entry.label}
                  </span>
                </div>
                {isActive && (
                  <p className="text-sm text-muted-foreground mt-1.5 ps-[52px] leading-relaxed max-w-[55ch]">
                    {entry.detail}
                  </p>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/60 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>47-minute video condensed to 4 chapters.</span>
        <span className="ms-auto inline-flex items-center gap-1 text-primary">
          <Play className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="font-semibold">Jump live</span>
        </span>
      </div>
    </article>
  );
});
