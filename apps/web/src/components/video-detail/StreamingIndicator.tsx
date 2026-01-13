import { Loader2, Radio } from "lucide-react";
import type { StreamPhase } from "@/hooks/use-summary-stream";

interface StreamingIndicatorProps {
  phase: StreamPhase;
  currentSectionIndex: number;
  totalSections: number;
}

const phaseLabels: Record<StreamPhase, string> = {
  idle: "Preparing...",
  connecting: "Connecting to AI...",
  metadata: "Fetching video info...",
  transcript: "Processing transcript...",
  parallel_analysis: "Analyzing content...",
  section_detect: "Analyzing video structure...",
  section_summaries: "Summarizing sections...",
  concepts: "Extracting key concepts...",
  synthesis: "Generating summary...",
  done: "Complete!",
  cancelled: "Summarization cancelled",
  error: "Error occurred",
};

export function StreamingIndicator({
  phase,
  currentSectionIndex,
  totalSections,
}: StreamingIndicatorProps) {
  const label = phase === "section_summaries" && currentSectionIndex >= 0
    ? `Summarizing section ${currentSectionIndex + 1}${totalSections > 0 ? ` of ${totalSections}` : ""}...`
    : phaseLabels[phase];

  return (
    <div className="fixed top-16 left-0 right-0 z-40 bg-primary/10 backdrop-blur-sm border-b border-primary/20">
      <div className="container mx-auto px-4 py-2 flex items-center gap-3">
        <div className="relative">
          <Radio className="h-4 w-4 text-primary animate-pulse" />
          <span className="absolute top-0 right-0 h-2 w-2 bg-primary rounded-full animate-ping" />
        </div>
        <span className="text-sm font-medium text-primary">
          {label}
        </span>
        <Loader2 className="h-4 w-4 animate-spin text-primary ml-auto" />
      </div>
    </div>
  );
}

// Issue #19: Add default export for consistency with other components
export default StreamingIndicator;
