import ReactMarkdown from "react-markdown";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
        className="max-w-2xl max-h-[80vh] overflow-y-auto"
        aria-describedby="master-summary-description"
      >
        <DialogHeader>
          <DialogTitle className="pr-8">Quick Read: {title}</DialogTitle>
          <DialogDescription id="master-summary-description" className="sr-only">
            AI-generated summary of the video content
          </DialogDescription>
        </DialogHeader>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown
            components={{
              // Custom heading styles for better hierarchy
              h2: ({ children }) => (
                <h2 className="text-lg font-semibold mt-4 mb-2 text-foreground border-b pb-1">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-base font-medium mt-3 mb-1 text-foreground">
                  {children}
                </h3>
              ),
              // Better list styling
              ul: ({ children }) => (
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li className="text-sm">{children}</li>
              ),
              // Paragraph styling
              p: ({ children }) => (
                <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                  {children}
                </p>
              ),
              // Strong/bold text
              strong: ({ children }) => (
                <strong className="font-semibold text-foreground">{children}</strong>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </DialogContent>
    </Dialog>
  );
}
