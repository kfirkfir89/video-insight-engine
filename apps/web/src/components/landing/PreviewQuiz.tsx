import { memo, useState } from "react";
import { Check, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const QUIZ_OPTIONS = [
  "A summary paragraph",
  "A transcript copy",
  "Interactive tabs — quiz, timeline, flashcards",
  "A list of YouTube links",
] as const;
const QUIZ_CORRECT_INDEX = 2;

/**
 * Narrow-tall bento card showing a real quiz interaction.
 * Part of the proof-of-product section; mirrors the actual
 * PreviewQuiz component from the output view but self-contained.
 */
export const PreviewQuiz = memo(function PreviewQuiz() {
  const [answered, setAnswered] = useState<number | null>(null);

  function handlePick(index: number): void {
    setAnswered(index);
  }

  return (
    <article className="landing-card h-full flex flex-col">
      <span className="landing-card__label">
        <span className="landing-card__label-num">02</span>
        Quiz
      </span>
      <h3 className="landing-card__title">
        What does VIE turn a video into?
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Tap an answer — real quizzes adapt per video.
      </p>

      <ul className="space-y-2 flex-1">
        {QUIZ_OPTIONS.map((opt, i) => {
          const isPicked = answered === i;
          const isCorrect = i === QUIZ_CORRECT_INDEX;
          const state =
            answered === null
              ? "idle"
              : isCorrect
                ? "correct"
                : isPicked
                  ? "wrong"
                  : "dim";
          return (
            <li key={opt}>
              <button
                type="button"
                onClick={() => handlePick(i)}
                aria-pressed={isPicked}
                className={cn(
                  "w-full text-start text-sm rounded-lg border px-3 py-2.5 transition-colors",
                  state === "idle" &&
                    "border-border hover:border-primary/40 hover:bg-primary/5 text-foreground",
                  state === "correct" &&
                    "border-success/60 bg-success-soft text-foreground",
                  state === "wrong" &&
                    "border-destructive/50 bg-destructive/5 text-muted-foreground",
                  state === "dim" && "border-border/40 text-muted-foreground/70",
                )}
              >
                <span className="inline-flex items-start gap-2">
                  {state === "correct" && (
                    <Check
                      className="h-4 w-4 text-success shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                  )}
                  {state !== "correct" && (
                    <HelpCircle
                      className="h-4 w-4 shrink-0 mt-0.5 opacity-40"
                      aria-hidden="true"
                    />
                  )}
                  <span>{opt}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </article>
  );
});
