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
      className="relative overflow-hidden rounded-xl flex"
    >
      {/* Low-opacity gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-primary/[0.03] to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/[0.04] to-transparent pointer-events-none" />

      {/* Content area */}
      <div className="relative flex-1 py-3 px-4 bg-background/80">
        <h2 className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-2">TL;DR</h2>
        {showSkeleton ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-foreground">
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

        {/* Key takeaways — full width */}
        {keyTakeaways.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {keyTakeaways.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-3.5 w-3.5 text-primary/70 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
