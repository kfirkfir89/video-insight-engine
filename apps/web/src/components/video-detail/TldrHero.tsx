import { CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface TldrHeroProps {
  tldr: string;
  keyTakeaways: string[];
  isStreaming?: boolean;
  thumbnailUrl?: string | null;
}

export function TldrHero({ tldr, keyTakeaways, isStreaming = false, thumbnailUrl }: TldrHeroProps) {
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

      {/* Thumbnail background — right side with left fade */}
      {thumbnailUrl && (
        <div
          className="absolute right-0 top-0 h-full w-1/2 pointer-events-none"
          style={{
            maskImage: "linear-gradient(to right, transparent 0%, black 8%)",
            WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 8%)",
          }}
        >
          <img
            src={thumbnailUrl}
            alt=""
            className="h-full w-full object-contain object-right opacity-75"
            loading="lazy"
          />
        </div>
      )}

      {/* Vertical TL;DR label strip — stretches full height */}
      <div className="relative w-8 shrink-0 bg-primary/[0.08] border-r border-primary/[0.10] flex items-center justify-center self-stretch">
        <span
          className="text-[14px] font-mono font-bold tracking-[0.5rem] text-primary/70 uppercase select-none"
          style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
        >
          TL;DR
        </span>
      </div>

      {/* Content area — white background for readability */}
      <div className="relative flex-1 py-6 px-8 bg-background/80">
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

        {keyTakeaways.length > 0 && (
          <ul className="mt-4 space-y-2">
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
