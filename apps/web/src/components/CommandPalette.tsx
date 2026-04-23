import { memo, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Search, Sparkles, LayoutGrid, MessageCircle, Keyboard, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAllVideos } from "@/hooks/use-videos";
import { useAuthStore } from "@/stores/auth-store";
import { useUIStore } from "@/stores/ui-store";
import { withViewTransition } from "@/lib/view-transitions";
import { parsePaletteQuery } from "@/components/command-palette/parse-query";
import type { Video } from "@/types";

interface PaletteAction {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
}

const MAX_RESULTS = 20;

/**
 * Global command palette — Cmd/Ctrl+K opens from anywhere.
 * Searches videos by title + channel, plus a set of quick-jump actions.
 */
export const CommandPalette = memo(function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const openSidebarSearch = useUIStore((s) => s.openSidebarSearch);
  const openShortcutsModal = useUIStore((s) => s.openShortcutsModal);
  const { data: videosData } = useAllVideos({ enabled: isAuthenticated });
  const videos = videosData?.videos ?? [];

  // Global open/close hotkeys — mount-once; use functional updater so Escape
  // doesn't need `open` captured in closure, avoiding listener churn on toggle.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isCmdK) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen((prev) => {
          if (!prev) return prev;
          e.preventDefault();
          return false;
        });
      }
    };
    const openByEvent = () => setOpen(true);
    window.addEventListener("keydown", handler);
    window.addEventListener("vie:open-command-palette", openByEvent);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("vie:open-command-palette", openByEvent);
    };
  }, []);

  // Reset state on open + restore focus on close
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      setQuery("");
      setActiveIndex(0);
      // Defer focus to next paint so the portal is mounted
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
    // Only restore focus if the palette was actually opened in this lifetime —
    // avoids a stray focus side-effect on initial mount when open=false.
    if (wasOpenRef.current) {
      returnFocusRef.current?.focus?.();
      returnFocusRef.current = null;
    }
  }, [open]);

  // Simple focus trap — cycle Tab within the dialog while open.
  const handleTabTrap = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const actions = useMemo<PaletteAction[]>(() => [
    {
      id: "generate",
      label: "Summarize a new video",
      hint: "Create",
      icon: Sparkles,
      run: () => navigate("/generate"),
    },
    {
      id: "board",
      label: "Go to your library",
      hint: "Navigate",
      icon: LayoutGrid,
      run: () => navigate("/board"),
    },
    {
      id: "assistant",
      label: "Ask the assistant",
      hint: "Navigate",
      icon: MessageCircle,
      run: () => {
        withViewTransition(() => {
          useUIStore.getState().setActiveSection("assistant");
          useUIStore.setState({ sidebarOpen: true });
        }, { type: "sidebar-collapse" });
      },
    },
    {
      id: "search",
      label: "Search your videos",
      hint: "Find",
      icon: Search,
      run: () => openSidebarSearch(),
    },
    {
      id: "shortcuts",
      label: "Keyboard shortcuts",
      hint: "Help",
      icon: Keyboard,
      run: () => openShortcutsModal(),
    },
  ], [navigate, openSidebarSearch, openShortcutsModal]);

  const parsed = useMemo(() => parsePaletteQuery(query), [query]);

  // Actions are free-text only. A query that is purely a status operator
  // (e.g. "is:done") hides all actions so the results list is video-only.
  const filteredActions = useMemo(() => {
    if (parsed.statusFilter) return [];
    const q = parsed.textQuery.toLowerCase();
    if (!q) return actions;
    return actions.filter((a) => a.label.toLowerCase().includes(q));
  }, [actions, parsed]);

  const filteredVideos = useMemo<Video[]>(() => {
    if (!videos.length) return [];
    const q = parsed.textQuery.toLowerCase();
    const hasAnyFilter = q.length > 0 || parsed.statusFilter !== null;
    if (!hasAnyFilter) return videos.slice(0, MAX_RESULTS);
    return videos
      .filter((v) => {
        if (parsed.statusFilter && !parsed.statusFilter.includes(v.status)) {
          return false;
        }
        if (!q) return true;
        const title = (v.title || "").toLowerCase();
        const channel = (v.channel || "").toLowerCase();
        return title.includes(q) || channel.includes(q);
      })
      .slice(0, MAX_RESULTS);
  }, [videos, parsed]);

  // Flat list for keyboard navigation
  const flatItems = useMemo(() => {
    const items: Array<
      | { type: "action"; action: PaletteAction }
      | { type: "video"; video: Video }
    > = [];
    for (const a of filteredActions) items.push({ type: "action", action: a });
    for (const v of filteredVideos) items.push({ type: "video", video: v });
    return items;
  }, [filteredActions, filteredVideos]);

  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, flatItems.length - 1)));
  }, [flatItems.length]);

  const runItem = (i: number) => {
    const item = flatItems[i];
    if (!item) return;
    setOpen(false);
    if (item.type === "action") {
      item.action.run();
    } else {
      navigate(`/video/${item.video.id}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(flatItems.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runItem(activeIndex);
    } else if (e.key === "Tab") {
      handleTabTrap(e);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-modal flex items-start justify-center pt-[8vh] sm:pt-[12vh] px-3 sm:px-4 pb-[calc(4rem+env(safe-area-inset-bottom)+1rem)] md:pb-4 bg-[var(--overlay-bg,rgb(0,0,0,0.45))] backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="command-palette-label"
      onClick={() => setOpen(false)}
      onKeyDown={handleKeyDown}
    >
      <span id="command-palette-label" className="sr-only">Command palette</span>
      <div
        ref={dialogRef}
        className="accent-rule w-full max-w-xl rounded-2xl bg-popover text-popover-foreground ring-1 ring-border/50 overflow-hidden animate-in zoom-in-95 duration-150"
        style={{ boxShadow: "var(--shadow-xl)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Search videos, jump anywhere..."
            aria-label="Command palette search"
            role="combobox"
            aria-expanded={flatItems.length > 0}
            aria-autocomplete="list"
            aria-controls="command-palette-results"
            aria-activedescendant={
              flatItems[activeIndex]
                ? flatItems[activeIndex].type === "action"
                  ? `cmd-action-${flatItems[activeIndex].action.id}`
                  : `cmd-video-${flatItems[activeIndex].video.id}`
                : undefined
            }
            className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/60"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div
          id="command-palette-results"
          className="max-h-[60vh] overflow-y-auto p-1"
          role="listbox"
          aria-label="Command palette results"
        >
          {flatItems.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground space-y-1">
              <p>No matches for &ldquo;{query}&rdquo;</p>
              <p className="type-caption">
                Try a title, channel, or a status filter:{" "}
                <kbd className="px-1 py-0.5 rounded bg-muted">is:processing</kbd>{" "}
                <kbd className="px-1 py-0.5 rounded bg-muted">is:done</kbd>{" "}
                <kbd className="px-1 py-0.5 rounded bg-muted">is:failed</kbd>
              </p>
            </div>
          )}

          {filteredActions.length > 0 && (
            <SectionHeader label="Actions" />
          )}
          {filteredActions.map((a, i) => {
            const globalIndex = i;
            const Icon = a.icon;
            return (
              <PaletteRow
                key={a.id}
                id={`cmd-action-${a.id}`}
                active={activeIndex === globalIndex}
                onMouseEnter={() => setActiveIndex(globalIndex)}
                onClick={() => runItem(globalIndex)}
                icon={<Icon className="h-4 w-4" aria-hidden="true" />}
                label={a.label}
                hint={a.hint}
              />
            );
          })}

          {filteredVideos.length > 0 && (
            <SectionHeader label={query.trim() ? "Videos" : "Recent videos"} />
          )}
          {filteredVideos.map((v, i) => {
            const globalIndex = filteredActions.length + i;
            return (
              <PaletteRow
                key={v.id}
                id={`cmd-video-${v.id}`}
                active={activeIndex === globalIndex}
                onMouseEnter={() => setActiveIndex(globalIndex)}
                onClick={() => runItem(globalIndex)}
                icon={
                  v.thumbnailUrl ? (
                    <img
                      src={v.thumbnailUrl}
                      alt=""
                      width={32}
                      height={20}
                      loading="lazy"
                      className="h-5 w-8 rounded object-cover shrink-0"
                    />
                  ) : (
                    <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                  )
                }
                label={v.title || "Untitled video"}
                hint={v.channel ?? undefined}
              />
            );
          })}
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-border/50 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted font-mono">↑</kbd>
              <kbd className="px-1 py-0.5 rounded bg-muted font-mono">↓</kbd>
              navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted font-mono">↵</kbd>
              select
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              openShortcutsModal();
            }}
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            All shortcuts
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
});

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="type-eyebrow px-3 pt-3 pb-1">
      {label}
    </div>
  );
}

function PaletteRow({
  id,
  active,
  onClick,
  onMouseEnter,
  icon,
  label,
  hint,
}: {
  id: string;
  active: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  icon: React.ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-start text-sm transition-colors",
        active ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-accent/50",
      )}
    >
      <span className="shrink-0 w-6 flex items-center justify-center text-muted-foreground">
        {icon}
      </span>
      <span className="flex-1 min-w-0 truncate">{label}</span>
      {hint && (
        <span
          className="text-xs text-muted-foreground shrink-0 max-w-[40%] truncate"
          title={hint}
        >
          {hint}
        </span>
      )}
    </button>
  );
}
