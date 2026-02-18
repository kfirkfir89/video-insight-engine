import { memo } from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface MarkdownContentProps {
  content: string;
  /** Compact mode: no headings, tighter spacing — for popovers */
  compact?: boolean;
  className?: string;
}

/**
 * Shared markdown renderer for LLM-generated content.
 *
 * Two modes:
 * - Default: full markdown with headings, lists, code — for drawers, modals, chat
 * - Compact: no headings, tighter spacing — for popovers and tooltips
 *
 * Security: ReactMarkdown v10+ safely converts markdown to React elements.
 * No dangerouslySetInnerHTML or rehype-raw.
 */
export const MarkdownContent = memo(function MarkdownContent({
  content,
  compact = false,
  className,
}: MarkdownContentProps) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        compact && "prose-p:mb-1.5 prose-p:leading-snug",
        className
      )}
    >
      <ReactMarkdown
        components={compact ? compactComponents : fullComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

/** Full markdown overrides — drawers, modals, chat bubbles */
const fullComponents = {
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-lg font-semibold mt-4 mb-2 text-foreground border-b pb-1">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-base font-medium mt-3 mb-1 text-foreground">
      {children}
    </h3>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-sm">{children}</li>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-sm text-muted-foreground leading-relaxed mb-2">
      {children}
    </p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
};

/** Compact markdown overrides — popovers, tooltips */
const compactComponents = {
  // Strip headings in compact mode — render as bold paragraphs
  h1: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-xs font-semibold text-foreground mb-1">{children}</p>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-xs font-semibold text-foreground mb-1">{children}</p>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-xs font-semibold text-foreground mb-1">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-xs">{children}</li>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-xs text-muted-foreground leading-relaxed mb-1.5">
      {children}
    </p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
};
