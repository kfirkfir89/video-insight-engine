import { useMemo } from "react";
import { Library, Brain, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  const setShowNewFolderInput = useUIStore((s) => s.setShowNewFolderInput);

  // Get counts for badges - count each section explicitly
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
    <div className="flex items-center border-b border-border/50 shrink-0 px-1">
      {TABS.map((tab) => {
        const isActive = activeSection === tab.key;
        const count = getCounts(tab.key);
        const Icon = tab.icon;

        return (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors relative",
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{tab.label}</span>
            {count > 0 && (
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full leading-none",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {count}
              </span>
            )}

            {/* Active indicator underline */}
            {isActive && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        );
      })}

      {/* Add folder button */}
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 mr-1"
              onClick={() => setShowNewFolderInput(true)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            New folder
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
