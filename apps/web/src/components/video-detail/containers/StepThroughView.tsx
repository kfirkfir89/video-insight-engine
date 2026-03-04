import { useState, useCallback, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StepThroughViewProps {
  steps: Array<{ id: string; content: ReactNode }>;
  className?: string;
}

export function StepThroughView({ steps, className }: StepThroughViewProps) {
  const [current, setCurrent] = useState(0);
  const total = steps.length;

  const prev = useCallback(
    () => setCurrent((c) => Math.max(0, c - 1)),
    []
  );
  const next = useCallback(
    () => setCurrent((c) => Math.min(total - 1, c + 1)),
    [total]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
    },
    [prev, next]
  );

  if (total === 0) return null;

  const progress = ((current + 1) / total) * 100;

  return (
    <div className={cn("outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 rounded", className)} tabIndex={0} onKeyDown={handleKeyDown} role="group" aria-label={`Step ${current + 1} of ${total}`}>
      {/* Progress bar */}
      <div className="h-1 bg-muted rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Navigator */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={prev}
          disabled={current === 0}
          className="gap-1"
          aria-label="Previous step"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        <span className="text-sm font-medium text-muted-foreground">
          Step {current + 1} of {total}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={next}
          disabled={current === total - 1}
          className="gap-1"
          aria-label="Next step"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Current step content */}
      <div key={steps[current]?.id} className="animate-[fade-up_0.3s_ease-out]">
        {steps[current]?.content}
      </div>
    </div>
  );
}
