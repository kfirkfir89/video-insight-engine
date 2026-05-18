import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { useUserUsage } from "@/hooks/use-usage";
import { cn } from "@/lib/utils";

interface UsageTileProps {
  /** Optional className for parent layouts (e.g. inside a popover) */
  className?: string;
  /** Hides upgrade CTA when the user already has a paid plan. */
  showUpgrade?: boolean;
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return "Unlimited";
  return `$${value.toFixed(2)}`;
}

function formatResetDistance(resetAtIso: string, now: number): string {
  const ms = new Date(resetAtIso).getTime() - now;
  if (Number.isNaN(ms) || ms <= 0) return "Resets shortly";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `Resets in ${Math.max(minutes, 1)}m`;
  if (minutes === 0) return `Resets in ${hours}h`;
  return `Resets in ${hours}h ${minutes}m`;
}

/** 60-second tick so the "Resets in Xh Ym" countdown stays accurate while open. */
function useMinuteTick(): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * Displays today's effective LLM spend, remaining headroom, and reset countdown.
 * Used in the user menu and on the dedicated /settings tile.
 */
export function UsageTile({ className, showUpgrade = true }: UsageTileProps) {
  const { data, isLoading, isError } = useUserUsage();
  const now = useMinuteTick();

  const stats = useMemo(() => {
    if (!data) return null;
    const unlimited = data.limitUsd <= 0;
    const percent = unlimited
      ? 0
      : Math.min(100, Math.max(0, Math.round((data.today.effectiveUsd / data.limitUsd) * 100)));
    return {
      tier: data.tier,
      effectiveUsd: data.today.effectiveUsd,
      limitUsd: data.limitUsd,
      remainingUsd: data.remainingUsd,
      videoCount: data.today.videoCount,
      resetAt: data.resetAt,
      unlimited,
      percent,
      atLimit: !unlimited && data.today.effectiveUsd >= data.limitUsd,
    };
  }, [data]);

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card/40 px-3 py-3 text-xs",
        "shadow-sm",
        className,
      )}
      role="region"
      aria-label="Daily usage"
      data-testid="usage-tile"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="type-eyebrow text-[10px] uppercase tracking-wide text-muted-foreground">
          Today&apos;s usage
        </p>
        <span className="text-[10px] font-medium text-muted-foreground capitalize">
          {stats?.tier ?? "—"}
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-3 text-muted-foreground" role="status" aria-live="polite">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          <span>Loading usage…</span>
        </div>
      ) : isError || !stats ? (
        <div className="flex items-center gap-2 py-3 text-amber-600 dark:text-amber-400" role="alert">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Could not load usage right now.</span>
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {formatUsd(stats.effectiveUsd)}
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {stats.unlimited ? "Unlimited" : `of ${formatUsd(stats.limitUsd)}`}
            </span>
          </div>

          {!stats.unlimited && (
            <div
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Daily usage progress"
              aria-valuenow={stats.percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={cn(
                  "h-full transition-all",
                  stats.atLimit
                    ? "bg-destructive"
                    : stats.percent > 80
                      ? "bg-amber-500"
                      : "bg-primary",
                )}
                style={{ width: `${Math.max(stats.percent, 2)}%` }}
              />
            </div>
          )}

          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {stats.videoCount === 0
                ? "No videos today"
                : `${stats.videoCount} video${stats.videoCount === 1 ? "" : "s"} processed`}
            </span>
            <span>{formatResetDistance(stats.resetAt, now)}</span>
          </div>

          {showUpgrade && stats.tier === "free" && (
            <Link
              to="/settings/billing"
              className={cn(
                "mt-3 inline-flex items-center gap-1.5 rounded-md border border-primary/30 px-2.5 py-1.5",
                "text-[11px] font-medium text-primary",
                "bg-primary/10 hover:bg-primary/15 transition-colors",
                "w-full justify-center",
              )}
              data-testid="usage-tile-upgrade-cta"
            >
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {stats.atLimit ? "Upgrade to Pro — daily limit reached" : "Upgrade to Pro for $20/day"}
            </Link>
          )}

          {stats.tier === "free" && !stats.atLimit && !stats.unlimited && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Free plan: {formatUsd(stats.limitUsd)} of LLM spend per day.
            </p>
          )}
        </>
      )}
    </div>
  );
}
