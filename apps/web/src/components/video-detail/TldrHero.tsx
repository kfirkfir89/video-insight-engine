import { CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface TldrHeroProps {
  tldr: string;
  keyTakeaways: string[];
  isStreaming?: boolean;
}

export function TldrHero({ tldr, keyTakeaways, isStreaming = false }: TldrHeroProps) {
  const showSkeleton = !tldr && isStreaming;
  const showCursor = isStreaming && tldr;

  return (
    <div
      data-slot="tldr-hero"
      className="relative overflow-hidden rounded-xl py-5 px-6"
    >
      {/* Low-opacity gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-primary/[0.03] to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/[0.04] to-transparent pointer-events-none" />

      <div className="relative">
        <span className="text-[10px] font-semibold text-primary/60 uppercase tracking-widest">
          TL;DR
        </span>
        {showSkeleton ? (
          <div className="space-y-2 mt-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-foreground mt-1.5">
            {tldr}
            {showCursor && (
              <span
                className={cn(
                  "inline-block w-0.5 h-4 ml-0.5 bg-primary align-middle",
                  "animate-pulse"
                )}
              />
            )}
          </p>
        )}

        {keyTakeaways.length > 0 && (
          <ul className="mt-3 space-y-1">
            {keyTakeaways.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <CheckCircle className="h-3 w-3 text-primary/70 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
