import { memo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore, useShortcutsModalOpen } from "@/stores/ui-store";

interface Shortcut {
  keys: string[];
  label: string;
}

const SHORTCUTS: { section: string; items: Shortcut[] }[] = [
  {
    section: "Global",
    items: [
      { keys: ["⌘", "K"], label: "Open command palette" },
      { keys: ["⌘", "B"], label: "Toggle sidebar" },
      { keys: ["?"], label: "Show keyboard shortcuts" },
      { keys: ["Esc"], label: "Close dialog or exit selection" },
    ],
  },
  {
    section: "Navigation",
    items: [
      { keys: ["↑", "↓"], label: "Move through results in the palette" },
      { keys: ["↵"], label: "Open the highlighted item" },
      { keys: ["←", "→"], label: "Resize sidebar by 20px (when the divider is focused)" },
      { keys: ["Home", "End"], label: "Snap sidebar to min / max width" },
    ],
  },
  {
    section: "Collection",
    items: [
      { keys: ["Shift", "Click"], label: "Select a range of videos and folders" },
      { keys: ["⌘", "Click"], label: "Add or remove a single item" },
    ],
  },
  {
    section: "Study tabs",
    items: [
      { keys: ["Space"], label: "Flip the current flashcard" },
      { keys: ["→"], label: "Mark flashcard known (after flip)" },
      { keys: ["←"], label: "Mark flashcard for review (after flip)" },
    ],
  },
];

const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.userAgent);

function translateKey(key: string): string {
  if (!isMac) {
    if (key === "⌘") return "Ctrl";
  }
  return key;
}

export const KeyboardShortcutsModal = memo(function KeyboardShortcutsModal() {
  const open = useShortcutsModalOpen();
  const toggleShortcutsModal = useUIStore((s) => s.toggleShortcutsModal);
  const closeShortcutsModal = useUIStore((s) => s.closeShortcutsModal);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Capture focus on open, restore on close
  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
    } else {
      returnFocusRef.current?.focus?.();
      returnFocusRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.key === "?" && !isEditable && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        toggleShortcutsModal();
      } else if (open && e.key === "Escape") {
        e.preventDefault();
        closeShortcutsModal();
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [open, toggleShortcutsModal, closeShortcutsModal]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-[var(--overlay-bg,rgb(0,0,0,0.45))] backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-shortcuts-title"
      onClick={closeShortcutsModal}
    >
      <div
        className="accent-rule w-full max-w-lg rounded-2xl bg-popover text-popover-foreground ring-1 ring-border/50 overflow-hidden animate-in zoom-in-95 duration-150"
        style={{ boxShadow: "var(--shadow-xl)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <h2 id="keyboard-shortcuts-title" className="type-h3">Keyboard shortcuts</h2>
          <button
            type="button"
            onClick={closeShortcutsModal}
            aria-label="Close shortcuts"
            className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {SHORTCUTS.map((group) => (
            <section key={group.section} className="space-y-2">
              <h3 className="type-eyebrow">
                {group.section}
              </h3>
              <ul className="space-y-1.5">
                {group.items.map((s) => (
                  <li key={s.label} className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-foreground/90">{s.label}</span>
                    <span className={cn("inline-flex items-center gap-1 shrink-0")}>
                      {s.keys.map((k, i) => (
                        <kbd
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-muted border border-border/60 text-[11px] text-foreground/90"
                        >
                          {translateKey(k)}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-border/50 text-[11px] text-muted-foreground">
          Press <kbd className="px-1.5 py-0.5 rounded bg-muted">?</kbd> anywhere to open this panel.
        </div>
      </div>
    </div>,
    document.body,
  );
});
