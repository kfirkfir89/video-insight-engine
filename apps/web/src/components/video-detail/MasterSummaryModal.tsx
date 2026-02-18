import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { ScrollContainer } from "@/components/ui/scroll-container";

interface MasterSummaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  content: string;
}

/**
 * Modal displaying the master summary of a video.
 *
 * Security Note: XSS Protection
 * -----------------------------
 * ReactMarkdown v9+ uses 'react-markdown' with rehype-sanitize by default,
 * which strips dangerous HTML. The content comes from our LLM-generated
 * summaries, but we still sanitize because:
 * 1. Defense in depth - never trust any input, even from our own backend
 * 2. LLM outputs could theoretically include injected HTML from transcripts
 * 3. ReactMarkdown's default behavior safely converts markdown to React elements
 *
 * We do NOT use dangerouslySetInnerHTML or rehype-raw plugin.
 */
export function MasterSummaryModal({
  open,
  onOpenChange,
  title,
  content,
}: MasterSummaryModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
        aria-describedby="master-summary-description"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="pr-8">Quick Read: {title}</DialogTitle>
          <DialogDescription id="master-summary-description" className="sr-only">
            AI-generated summary of the video content
          </DialogDescription>
        </DialogHeader>
        <ScrollContainer wrapperClassName="flex-1 min-h-0">
          <MarkdownContent content={content} />
        </ScrollContainer>
      </DialogContent>
    </Dialog>
  );
}
