/**
 * StreamingText component for displaying LLM responses with typing animation.
 */

import { cn } from "@/lib/utils";

interface StreamingTextProps {
  /** The text content to display */
  content: string;
  /** Whether the text is still streaming */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Show cursor animation */
  showCursor?: boolean;
}

/**
 * Displays streaming text with an optional animated cursor.
 *
 * @example
 * ```tsx
 * <StreamingText
 *   content={message.content}
 *   isLoading={isStreaming}
 *   className="prose"
 * />
 * ```
 */
export function StreamingText({
  content,
  isLoading = false,
  className,
  showCursor = true,
}: StreamingTextProps) {
  return (
    <div className={cn("whitespace-pre-wrap", className)}>
      {content}
      {isLoading && showCursor && (
        <span className="inline-block w-2 h-4 ml-0.5 bg-current animate-pulse" />
      )}
    </div>
  );
}

/**
 * Displays streaming text formatted as markdown.
 * Use this for longer responses that may contain formatting.
 */
export function StreamingMarkdown({
  content,
  isLoading = false,
  className,
}: StreamingTextProps) {
  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
      <div className="whitespace-pre-wrap">
        {content}
        {isLoading && (
          <span className="inline-block w-2 h-4 ml-0.5 bg-primary/80 animate-pulse rounded-sm" />
        )}
      </div>
    </div>
  );
}
