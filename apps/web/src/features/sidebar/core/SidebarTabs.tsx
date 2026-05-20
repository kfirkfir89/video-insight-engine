import { useMemo } from "react";
import { Library, MessageCircle } from "lucide-react";
import { useUIStore, useActiveSection, type ActiveSection } from "@/stores/ui-store";
import { useAllVideos } from "@/hooks/use-videos";
import { useFolders } from "@/hooks/use-folders";
import { cn } from "@/lib/utils";

interface TabConfig {
  key: ActiveSection;
  label: string;
  icon: typeof Library;
  showCount?: boolean;
  /** Accent role — primary for Collection (library of work), coral for Assistant (conversational/agentic) */
  accent: "primary" | "coral";
}

const TABS: TabConfig[] = [
  { key: "summarized", label: "Collection", icon: Library, showCount: true, accent: "primary" },
  { key: "assistant", label: "Assistant", icon: MessageCircle, accent: "coral" },
];

export function SidebarTabs() {
  const activeSection = useActiveSection();
  const setActiveSection = useUIStore((s) => s.setActiveSection);

  const { data: videosData } = useAllVideos();
  const { data: summarizedFolders } = useFolders();

  const summarizedCount = useMemo(() => {
    const sumFolderIds = new Set(
      (summarizedFolders?.folders ?? []).map((f) => f.id)
    );
    const videos = videosData?.videos ?? [];
    return videos.filter(
      (v) => !v.folderId || sumFolderIds.has(v.folderId)
    ).length;
  }, [videosData?.videos, summarizedFolders?.folders]);

  return (
    <div className="flex items-center shrink-0 px-2 gap-1 py-1">
      {TABS.map((tab) => {
        const isActive = activeSection === tab.key;
        const count = tab.showCount ? summarizedCount : 0;
        const Icon = tab.icon;
        const isCoral = tab.accent === "coral";
        return (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              // min-h keeps the hit-target ≥36px even with the eyebrow type;
              // relative + overflow-hidden so the 2px top rule clips to the
              // button's rounded corners (no MobileBottomNav-style hard edge).
              "group relative flex-1 flex items-center justify-center gap-1.5 min-h-9 py-2",
              "rounded-md overflow-hidden transition-colors",
              // .type-eyebrow brings uppercase 11px + 0.08em tracking + 600
              // weight. We promote labels to read as section dividers, not
              // generic tabs. Inactive tabs keep muted-foreground; we override
              // for the active state below.
              "type-eyebrow",
              isActive
                ? isCoral
                  ? "text-[var(--vie-coral)] bg-[oklch(from_var(--vie-coral)_l_c_h_/_0.1)] ring-1 ring-[oklch(from_var(--vie-coral)_l_c_h_/_0.22)]"
                  // Arbitrary value `text-[color:var(--primary)]` mirrors the
                  // coral pattern above: arbitrary utilities sort late and
                  // win the cascade over `.type-eyebrow`'s color, so no
                  // `!important` escape hatch is needed.
                  : "text-[color:var(--primary)] bg-primary/8 ring-1 ring-primary/20"
                : "hover:text-foreground hover:bg-accent/50",
            )}
          >
            {/* --rule-active top accent: 2px chromatic mark for the current
                tab. Matches the MobileBottomNav active-state language per
                DESIGN.md §5 Navigation. Coral tab gets a coral-tinted rule. */}
            {isActive && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-x-2 top-0 h-0.5 rounded-full",
                  isCoral
                    ? "bg-[linear-gradient(90deg,transparent,var(--vie-coral),transparent)]"
                    : "bg-[var(--rule-active)]",
                )}
              />
            )}
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{tab.label}</span>
            {count > 0 && (
              <span
                className={cn(
                  // Counts are a different signal than the eyebrow label —
                  // reset case + tracking so they don't look uppercased.
                  "normal-case tracking-normal text-[10px] px-1.5 py-0.5 rounded-full leading-none tabular-nums",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
