import { CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    <Card
      data-slot="tldr-hero"
      className="relative overflow-hidden border-0 bg-gradient-to-br from-card to-muted/30"
    >
      {/* Subtle gradient accent */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />

      <CardContent className="relative py-8 px-6">
        <Badge variant="secondary" className="mb-3 font-medium">
          TL;DR
        </Badge>
        {showSkeleton ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-5 w-3/5" />
          </div>
        ) : (
          <p className="text-lg leading-relaxed text-foreground">
            {tldr}
            {showCursor && (
              <span
                className={cn(
                  "inline-block w-0.5 h-5 ml-0.5 bg-primary align-middle",
                  "animate-pulse"
                )}
              />
            )}
          </p>
        )}

        {/* Key takeaways as bullets */}
        {keyTakeaways.length > 0 && (
          <ul className="mt-6 space-y-2">
            {keyTakeaways.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
