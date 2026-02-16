import { useState, useCallback } from "react";
import type { SummaryChapter } from "@vie/types";
import { chaptersToMarkdown, copyToClipboard, downloadAsFile } from "@/lib/block-to-markdown";

interface UseMarkdownExportReturn {
  copiedState: boolean;
  handleCopyMarkdown: () => Promise<void>;
  handleDownloadMarkdown: () => void;
}

/**
 * Shared hook for copy-to-clipboard and download-as-file of chapter Markdown.
 * Used by both Desktop and Mobile video detail layouts.
 */
export function useMarkdownExport(
  title: string,
  chapters: SummaryChapter[] | undefined
): UseMarkdownExportReturn {
  const [copiedState, setCopiedState] = useState(false);

  const handleCopyMarkdown = useCallback(async () => {
    if (!chapters) return;
    const md = chaptersToMarkdown(title, chapters);
    const ok = await copyToClipboard(md);
    if (ok) {
      setCopiedState(true);
      setTimeout(() => setCopiedState(false), 2000);
    }
  }, [chapters, title]);

  const handleDownloadMarkdown = useCallback(() => {
    if (!chapters) return;
    const md = chaptersToMarkdown(title, chapters);
    const safeName = title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 50);
    downloadAsFile(md, `${safeName}.md`);
  }, [chapters, title]);

  return { copiedState, handleCopyMarkdown, handleDownloadMarkdown };
}
