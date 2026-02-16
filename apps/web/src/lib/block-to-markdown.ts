import type { ContentBlock, SummaryChapter } from "@vie/types";

/**
 * Convert a single ContentBlock to Markdown text.
 */
function blockToMarkdown(block: ContentBlock): string {
  switch (block.type) {
    case "paragraph":
      return block.text;
    case "bullets":
      return block.items.map((item) => `- ${item}`).join("\n");
    case "numbered":
      return block.items
        .map((item: string, i: number) => `${i + 1}. ${item}`)
        .join("\n");
    case "code":
      return `\`\`\`${block.language ?? ""}\n${block.code}\n\`\`\``;
    case "quote":
      return block.text
        .split("\n")
        .map((line: string) => `> ${line}`)
        .join("\n");
    case "table": {
      if (!block.columns || !block.rows) return "";
      const labels = block.columns.map((c) => c.label);
      const keys = block.columns.map((c) => c.key);
      const header = `| ${labels.join(" | ")} |`;
      const separator = `| ${labels.map(() => "---").join(" | ")} |`;
      const rows = block.rows
        .map((row) => `| ${keys.map((k) => String(row[k] ?? "")).join(" | ")} |`)
        .join("\n");
      return `${header}\n${separator}\n${rows}`;
    }
    case "callout":
      return `> **${block.style ?? "Note"}:** ${block.text}`;
    case "timestamp":
      return `**[${block.label}]** (${block.time})`;
    case "definition":
      return `**${block.term}:** ${block.meaning}`;
    case "keyvalue":
      return block.items.map((kv) => `- **${kv.key}:** ${kv.value}`).join("\n");
    case "comparison":
      return [
        `**${block.left.label}:** ${block.left.items.join(", ")}`,
        `**${block.right.label}:** ${block.right.items.join(", ")}`,
      ].join("\n");
    case "example":
      return [
        block.title ? `**${block.title}**` : null,
        `\`\`\`\n${block.code}\n\`\`\``,
        block.explanation ?? null,
      ]
        .filter(Boolean)
        .join("\n\n");
    case "do_dont":
      return [
        "**Do:**",
        ...block.do.map((d) => `- ${d}`),
        "**Don't:**",
        ...block.dont.map((d) => `- ${d}`),
      ].join("\n");
    case "statistic":
      return block.items
        .map((s) => `- **${s.value}** ${s.label}${s.context ? ` (${s.context})` : ""}`)
        .join("\n");
    default:
      // For any block with a text property, extract it
      if ("text" in block && typeof block.text === "string") {
        return block.text;
      }
      if ("items" in block && Array.isArray(block.items)) {
        return block.items.map((item: unknown) => `- ${String(item)}`).join("\n");
      }
      return "";
  }
}

/**
 * Convert an array of ContentBlocks to a Markdown string.
 */
export function blocksToMarkdown(blocks: ContentBlock[]): string {
  return blocks
    .map(blockToMarkdown)
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Convert a full chapter to Markdown with title and timestamp.
 */
export function chapterToMarkdown(chapter: SummaryChapter): string {
  const parts: string[] = [];
  parts.push(`## ${chapter.title}`);
  if (chapter.timestamp) {
    parts.push(`*${chapter.timestamp}*`);
  }
  if (chapter.content && chapter.content.length > 0) {
    parts.push(blocksToMarkdown(chapter.content));
  }
  return parts.join("\n\n");
}

/**
 * Convert all chapters to a single Markdown document.
 */
export function chaptersToMarkdown(
  title: string,
  chapters: SummaryChapter[]
): string {
  const parts: string[] = [`# ${title}`, ""];
  for (const chapter of chapters) {
    parts.push(chapterToMarkdown(chapter));
    parts.push("");
  }
  return parts.join("\n");
}

/**
 * Copy text to clipboard.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Download text as a file.
 */
export function downloadAsFile(
  content: string,
  filename: string,
  mimeType = "text/markdown"
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
