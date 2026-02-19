import { memo } from "react";
import { Loader2, BookOpen, RefreshCw } from "lucide-react";
import { useExplainAuto } from "@/hooks/use-explain-auto";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { cn } from "@/lib/utils";

interface GoDeepDrawerProps {
  videoSummaryId: string;
  chapterId: string;
  className?: string;
}

/**
 * Expandable drawer showing auto-generated "Go Deeper" explanation for a chapter.
 * Content is fetched via useExplainAuto and cached server-side.
 */
export const GoDeepDrawer = memo(function GoDeepDrawer({
  videoSummaryId,
  chapterId,
  className,
}: GoDeepDrawerProps) {
  const { data, isLoading, error, refetch } = useExplainAuto(
    videoSummaryId,
    "section",
    chapterId
  );

  return (
    <div
      className={cn(
        "border-l-2 border-primary/20 pl-4 py-3 my-3 bg-primary/5 rounded-r-lg",
        className
      )}
    >
      <div className="flex items-center gap-2 mb-2 text-sm font-medium text-primary">
        <BookOpen className="h-4 w-4" aria-hidden="true" />
        <span>Go Deeper</span>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Generating explanation...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2">
          <p className="text-sm text-destructive">
            Failed to load explanation.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
          >
            <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
            Retry
          </Button>
        </div>
      )}

      {data?.expansion && (
        <MarkdownContent content={data.expansion} className="text-foreground/90" />
      )}
    </div>
  );
});
