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
              "flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-md transition-colors",
              isActive
                ? isCoral
                  ? "text-[var(--vie-coral)] bg-[oklch(from_var(--vie-coral)_l_c_h_/_0.1)] ring-1 ring-[oklch(from_var(--vie-coral)_l_c_h_/_0.22)]"
                  : "text-primary bg-primary/10 ring-1 ring-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{tab.label}</span>
            {count > 0 && (
              <span
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full leading-none tabular-nums",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
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
