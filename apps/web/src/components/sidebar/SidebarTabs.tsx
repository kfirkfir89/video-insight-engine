import { useMemo } from "react";
import { Library, Brain } from "lucide-react";
import { useUIStore, useActiveSection, type ActiveSection } from "@/stores/ui-store";
import { useAllVideos } from "@/hooks/use-videos";
import { useFolders } from "@/hooks/use-folders";
import { cn } from "@/lib/utils";

interface TabConfig {
  key: ActiveSection;
  label: string;
  icon: typeof Library;
}

const TABS: TabConfig[] = [
  { key: "summarized", label: "Summaries", icon: Library },
  { key: "memorized", label: "Memorized", icon: Brain },
];

export function SidebarTabs() {
  const activeSection = useActiveSection();
  const setActiveSection = useUIStore((s) => s.setActiveSection);

  const { data: videosData } = useAllVideos();
  const { data: summarizedFolders } = useFolders("summarized");
  const { data: memorizedFolders } = useFolders("memorized");

  const { summarizedCount, memorizedCount } = useMemo(() => {
    const sumFolderIds = new Set(
      (summarizedFolders?.folders ?? []).map((f) => f.id)
    );
    const memFolderIds = new Set(
      (memorizedFolders?.folders ?? []).map((f) => f.id)
    );
    const videos = videosData?.videos ?? [];
    return {
      summarizedCount: videos.filter(
        (v) => !v.folderId || sumFolderIds.has(v.folderId)
      ).length,
      memorizedCount: videos.filter(
        (v) => v.folderId && memFolderIds.has(v.folderId)
      ).length,
    };
  }, [videosData?.videos, summarizedFolders?.folders, memorizedFolders?.folders]);

  const getCounts = (key: ActiveSection) =>
    key === "summarized" ? summarizedCount : memorizedCount;

  return (
    <div className="flex items-center shrink-0 px-2 gap-1 py-1">
      {TABS.map((tab) => {
        const isActive = activeSection === tab.key;
        const count = getCounts(tab.key);
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors",
              isActive
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{tab.label}</span>
            {count > 0 && (
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full leading-none",
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
