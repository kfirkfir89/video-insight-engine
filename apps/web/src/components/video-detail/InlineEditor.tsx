import { memo, useRef, useCallback, useEffect, useState } from "react";
import { Check, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface InlineEditorProps {
  value: string;
  onSave: (newValue: string) => void;
  onCancel?: () => void;
  className?: string;
  as?: "p" | "span" | "h2" | "h3";
}

/**
 * Inline contentEditable wrapper for text blocks.
 * Paste-as-plain-text only. Visual indicator for edit mode.
 */
export const InlineEditor = memo(function InlineEditor({
  value,
  onSave,
  onCancel,
  className,
  as: Tag = "p",
}: InlineEditorProps) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const originalValue = useRef(value);

  const startEditing = useCallback(() => {
    setEditing(true);
    originalValue.current = value;
    // Populate DOM and focus after React re-render (children are empty in edit mode)
    requestAnimationFrame(() => {
      if (ref.current) {
        ref.current.textContent = value;
        ref.current.focus();
      }
    });
  }, [value]);

  const save = useCallback(() => {
    const text = ref.current?.textContent ?? "";
    if (text !== originalValue.current) {
      onSave(text);
    }
    setEditing(false);
  }, [onSave]);

  const cancel = useCallback(() => {
    if (ref.current) {
      ref.current.textContent = originalValue.current;
    }
    setEditing(false);
    onCancel?.();
  }, [onCancel]);

  // Prevent rich text paste — insert plain text only, enforce max length
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    let text = e.clipboardData.getData("text/plain");
    // Enforce max length (5000 chars) to prevent extremely large content
    const currentLen = ref.current?.textContent?.length ?? 0;
    const maxLen = 5000;
    if (currentLen + text.length > maxLen) {
      text = text.slice(0, maxLen - currentLen);
    }
    if (!text) return;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }, []);

  // Keyboard: Enter saves, Escape cancels
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        save();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    },
    [save, cancel]
  );

  // Sync value when not editing
  useEffect(() => {
    if (!editing && ref.current) {
      ref.current.textContent = value;
    }
  }, [value, editing]);

  return (
    <div className={cn("group relative", className)}>
      <Tag
        ref={(el: HTMLElement | null) => {
          ref.current = el;
        }}
        contentEditable={editing}
        suppressContentEditableWarning
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onBlur={editing ? save : undefined}
        className={cn(
          "outline-none transition-all min-h-[1.5em]",
          editing && "ring-1 ring-primary/30 rounded px-1 -mx-1 bg-primary/5"
        )}
        role={editing ? "textbox" : undefined}
        aria-label={editing ? "Edit text" : undefined}
      >
        {editing ? undefined : value}
      </Tag>

      {/* Edit trigger (shown on hover when not editing) */}
      {!editing && (
        <button
          onClick={startEditing}
          className="absolute -right-6 top-0 opacity-0 group-hover:opacity-60 group-focus-within:opacity-60 focus:opacity-100 hover:!opacity-100 transition-opacity p-0.5"
          aria-label="Edit"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}

      {/* Save/cancel controls */}
      {editing && (
        <div className="flex items-center gap-1 mt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs gap-1"
            onClick={save}
          >
            <Check className="h-3 w-3" />
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs gap-1 text-muted-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={cancel}
          >
            <X className="h-3 w-3" />
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
});
