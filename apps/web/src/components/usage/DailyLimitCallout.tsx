import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface DailyLimitCalloutProps {
  limitUsd: number | null;
  resetAtIso: string | null;
  className?: string;
}

function formatResetDistance(iso: string | null, now: number): string {
  if (!iso) return "midnight UTC";
  const ms = new Date(iso).getTime() - now;
  if (Number.isNaN(ms) || ms <= 0) return "shortly";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `in ${Math.max(minutes, 1)} min`;
  if (minutes === 0) return `in ${hours}h`;
  return `in ${hours}h ${minutes}m`;
}

/** Inline callout rendered when the API returns 429 DAILY_LIMIT_REACHED. */
export function DailyLimitCallout({ limitUsd, resetAtIso, className }: DailyLimitCalloutProps) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const limit = typeof limitUsd === "number" && limitUsd > 0 ? `$${limitUsd.toFixed(2)}` : null;
  const reset = formatResetDistance(resetAtIso, now);

  return (
    <div
      role="alert"
      data-testid="daily-limit-callout"
      className={cn(
        "mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm",
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-medium text-foreground">
            You&apos;ve hit your daily limit{limit ? ` (${limit})` : ""}.
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Free spend resets {reset}. Upgrade to Pro for $20/day of headroom.
          </p>
        </div>
      </div>
      <Link
        to="/settings/billing"
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5",
          "text-xs font-semibold bg-primary text-primary-foreground",
          "hover:bg-primary/90 transition-colors shrink-0",
        )}
        data-testid="daily-limit-upgrade"
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        Upgrade to Pro
      </Link>
    </div>
  );
}
