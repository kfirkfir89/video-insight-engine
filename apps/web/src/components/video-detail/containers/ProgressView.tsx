import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { CheckCircle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressItem {
  id: string;
  label: string;
  content: ReactNode;
}

interface ProgressViewProps {
  items: ProgressItem[];
  storageKey?: string;
  className?: string;
}

function readProgress(key: string | undefined): Set<string> {
  if (!key) return new Set();
  try {
    const stored = localStorage.getItem(`vie-progress-${key}`);
    if (!stored) return new Set();
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch (err) {
    console.warn(`Failed to read progress for "${key}":`, err);
    return new Set();
  }
}

export function ProgressView({
  items,
  storageKey,
  className,
}: ProgressViewProps) {
  const [completed, setCompleted] = useState<Set<string>>(() =>
    readProgress(storageKey)
  );
  const isUserAction = useRef(false);

  // Re-sync when storageKey changes
  useEffect(() => {
    setCompleted(readProgress(storageKey));
    isUserAction.current = false;
  }, [storageKey]);

  // Persist only user-initiated changes
  useEffect(() => {
    if (!isUserAction.current) return;
    if (storageKey) {
      localStorage.setItem(
        `vie-progress-${storageKey}`,
        JSON.stringify([...completed])
      );
    }
  }, [completed, storageKey]);

  const toggle = useCallback((id: string) => {
    isUserAction.current = true;
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const completedCount = items.filter((item) => completed.has(item.id)).length;
  const progress = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  return (
    <div className={className}>
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          {completedCount}/{items.length}
        </span>
      </div>

      {/* Items */}
      <div className="space-y-3">
        {items.map((item) => {
          const isDone = completed.has(item.id);
          return (
            <div key={item.id} className="flex gap-3">
              <button
                onClick={() => toggle(item.id)}
                className={cn(
                  "mt-0.5 shrink-0 transition-colors",
                  isDone
                    ? "text-primary"
                    : "text-muted-foreground/40 hover:text-muted-foreground"
                )}
                aria-label={
                  isDone
                    ? `Mark ${item.label} incomplete`
                    : `Mark ${item.label} complete`
                }
              >
                {isDone ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
              </button>
              <div className={cn("flex-1 min-w-0", isDone && "opacity-60")}>
                {item.content}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
